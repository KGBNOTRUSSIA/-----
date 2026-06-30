import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";
import { parseDocument } from "./src/utils/documentParser.js";
import { extractFieldsFromText } from "./src/utils/localFieldExtractor.js";
import { analyzeReferenceForm, findKnownLabels, filterInstructionText, extractFieldsDynamic } from "./src/utils/referenceAnalyzer.js";
import dotenv from "dotenv";

dotenv.config();

// Ensure Gemini API Key is loaded safely
const getGeminiClient = (): GoogleGenAI => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY environment variable is not configured. Please set your API key in Settings > Secrets.");
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

const app = express();
const PORT = 3000;

// Enable JSON bodies
app.use(express.json());

// Set up file upload middleware via multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max file size
    files: 20 // 20 files maximum limit per batch as specified in the PRD
  }
});

// Definition of Schema according to modern @google/genai requirements
const applicationSchema = {
  type: Type.OBJECT,
  properties: {
    teacherName: { 
      type: Type.STRING, 
      description: "성명. 신청서 내 '성명' 항목에 적힌 정보를 추출합니다." 
    },
    teacherAffiliation: { 
      type: Type.STRING, 
      description: "소속 (소속 학교명, 기관명, 교육청 등)" 
    },
    desiredCourse: { 
      type: Type.STRING, 
      description: "희망 강좌. 신청서 내 '희망 강좌' 또는 '신청 프로그램' 항목의 내용을 추출합니다." 
    },
    studentCount: { 
      type: Type.STRING, 
      description: "수강인원. 신청서 내 '수강인원' 항목에 적힌 인원 수를 추출합니다." 
    },
    studentGrade: { 
      type: Type.STRING, 
      description: "수강학년. 신청서 내 '수강학년' 항목에 적힌 학년 정보를 추출합니다." 
    },
    shootingDate: { 
      type: Type.STRING, 
      description: "수업촬영일. 반드시 'YYYY년 MM월 DD일' 형식으로 포맷을 정규화한다. 연도가 누락되어 '5월 12일'과 같이 월/일만 기재된 경우에는 현재 기준 연도인 '2026년'을 반영하여 '2026년 05월 12일'로 표준화한다. 날짜를 찾을 수 없는 경우 빈 문자열로 처리." 
    },
    classroom: { 
      type: Type.STRING, 
      description: "강의실. 신청서 내 '강의실' 또는 '희망 강의실' 항목에 적힌 정보를 추출합니다." 
    },
    teachingMethod: { 
      type: Type.STRING, 
      description: "교수방법. 신청서 내 '교수방법' 항목에 해당하는 내용을 그대로 추출합니다." 
    },
    microteachingRequests: { 
      type: Type.STRING, 
      description: "마이크로티칭 요청사항. 신청서 내 '요청사항' 또는 '마이크로티칭 요청사항'에 해당하는 내용을 그대로 추출합니다." 
    },
  },
  required: [
    "teacherName", "teacherAffiliation", "desiredCourse", "studentCount", "studentGrade",
    "shootingDate", "classroom", "teachingMethod", "microteachingRequests"
  ]
};

// In-memory reference forms storage
const referenceStore = new Map<string, { fileName: string; text: string; knowledge: ReturnType<typeof analyzeReferenceForm> }>();

// Upload reference form
app.post("/api/reference-form", upload.single("reference"), async (req, res) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    const programName = req.body?.programName as string;
    if (!file || !programName?.trim()) {
      return res.status(400).json({ error: "프로그램명과 기준 양식 파일이 필요합니다." });
    }
    const text = await parseDocument(file.originalname, file.buffer);
    const knowledge = analyzeReferenceForm(text || '', programName.trim());
    referenceStore.set(programName.trim(), { fileName: file.originalname, text: text || '', knowledge });
    console.log(`[Server] Reference form registered: "${programName.trim()}" — ${knowledge.fieldLabels.length} fields learned`);
    return res.json({ success: true, programName: programName.trim(), fieldsLearned: knowledge.fieldLabels.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "기준 양식 업로드 실패" });
  }
});

// List stored reference forms
app.get("/api/reference-forms", (req, res) => {
  const forms = [...referenceStore.entries()].map(([programName, data]) => ({
    programName, fileName: data.fileName, fieldsLearned: data.knowledge.fieldLabels.length
  }));
  return res.json({ forms });
});

// Delete reference form
app.delete("/api/reference-form/:name", (req, res) => {
  const name = decodeURIComponent(req.params.name);
  referenceStore.delete(name);
  return res.json({ success: true });
});

// Preset program reference forms
const PRESET_FORMS: Record<string, string> = {
  '마이크로티칭': 'C:\\Users\\ITS\\Downloads\\[양식] 마이크로티칭 신청서.pdf',
  '교수코칭': 'C:\\Users\\ITS\\Downloads\\[양식] 교수코칭 신청서.pdf',
  'SEMO Class 수업컨설팅': 'C:\\Users\\ITS\\Downloads\\[양식] SEMO Class 수업컨설팅 신청서.pdf',
  '티칭 클리닉': 'C:\\Users\\ITS\\Downloads\\[양식] 수업개선을 위한 맞춤형 티칭 클리닉 신청서.pdf',
};

// Load preset reference form
app.post("/api/preset-reference/:name", async (req, res) => {
  try {
    const presetName = decodeURIComponent(req.params.name);
    const filePath = PRESET_FORMS[presetName];
    if (!filePath) {
      return res.status(404).json({ error: `"${presetName}"에 해당하는 양식 파일이 없습니다.` });
    }
    const { readFileSync } = await import('fs');
    const buffer = readFileSync(filePath);
    const text = await parseDocument(`[${presetName}] 신청서.pdf`, buffer);
    const knowledge = analyzeReferenceForm(text || '', presetName);
    referenceStore.set(presetName, { fileName: `[${presetName}] 신청서.pdf`, text: text || '', knowledge });
    console.log(`[Server] Preset reference loaded: "${presetName}" — ${knowledge.fieldLabels.length} fields`);
    return res.json({ success: true, programName: presetName, fieldsLearned: knowledge.fieldLabels.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "프리셋 양식 로드 실패" });
  }
});

// Main processing API route
app.post("/api/parse-documents", upload.array("files", 20), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "업로드된 파일이 없습니다." });
    }

    let ai: GoogleGenAI | null = null;
    let geminiAvailable = true;
    try {
      ai = getGeminiClient();
    } catch (keyError: any) {
      console.warn("[Server] Gemini API key not configured — using local fallback parser.");
      geminiAvailable = false;
    }

    const getSupportedMultimodalMimeType = (filename: string, mimetype: string): string | null => {
      const ext = filename.split('.').pop()?.toLowerCase();
      if (ext === 'pdf' || mimetype === 'application/pdf') {
        return 'application/pdf';
      }
      if (ext === 'png' || mimetype === 'image/png') {
        return 'image/png';
      }
      if (ext === 'jpg' || ext === 'jpeg' || mimetype === 'image/jpeg') {
        return 'image/jpeg';
      }
      if (ext === 'webp' || mimetype === 'image/webp') {
        return 'image/webp';
      }
      return null;
    };

    const results = [];

    for (const file of files) {
      try {
        // Always extract text first (needed for local fallback, also works as base for Gemini)
        const extractedText = await parseDocument(file.originalname, file.buffer);

        if (!extractedText || extractedText.trim().length === 0) {
          results.push({
            fileName: file.originalname,
            status: "error",
            error: "파일에서 텍스트를 추출하지 못했습니다. 문서가 스캔 이미지 형태이거나 암호화되어 있을 수 있습니다."
          });
          continue;
        }

        if (geminiAvailable && ai) {
          // Use Gemini for structured extraction
          const multimodalMimeType = getSupportedMultimodalMimeType(file.originalname, file.mimetype);
          let contents;

          if (multimodalMimeType) {
            console.log(`[Document Processor] Sending multimodal file directly to Gemini: ${file.originalname} as ${multimodalMimeType}`);
            contents = [
              {
                inlineData: {
                  mimeType: multimodalMimeType,
                  data: file.buffer.toString("base64")
                }
              },
              { text: "제공된 파일(신청서 문서)을 직접 읽고 분석하여 모든 항목의 정보를 정확하게 추출하여 JSON 포맷으로 생성해 주세요." }
            ];
          } else {
            contents = [
              { text: `[신청서 텍스트 시작]\n${extractedText}\n[신청서 텍스트 끝]\n위 텍스트에서 데이터를 추출해 정규화된 규격으로 출력해 주세요.` }
            ];
          }

          console.log(`[Document Processor] Structuring content via Gemini: ${file.originalname}`);

          const systemPrompt = `당신은 교원 신청 서류 데이터 추출 및 정규화 전문가입니다.
제공된 교원 신청서 문서 또는 텍스트에서 9개 항목 정보를 정확하게 식별하고 정규화 규칙을 엄격하게 적용하여 JSON 형식으로 구조화해 주십시오.

[필수 추출 가이드]
1. 성명 (teacherName): 신청서 내 '성명' 항목 정보를 정확히 추출합니다.
2. 소속 (teacherAffiliation): 신청서 내 '소속' 항목에 적힌 정보(예: "대학원 가속기과학과")를 정확히 추출합니다.
3. 희망 강좌 (desiredCourse): 신청서 내 '희망 강좌' 또는 '신청 프로그램' 항목의 내용을 추출합니다.
4. 수강인원 (studentCount): 신청서 내 '수강인원' 항목에 적힌 인원 수 정보를 추출합니다.
5. 수강학년 (studentGrade): 신청서 내 '수강학년' 항목에 적힌 학년 정보를 추출합니다.
6. 수업촬영일 (shootingDate): 신청서 내 '수업촬영일' 항목의 날짜 정보를 추출합니다.
7. 강의실 (classroom): 신청서 내 '강의실' 또는 '희망 강의실' 항목에 적힌 정보를 추출합니다.
8. 교수방법 (teachingMethod): 신청서 내 '교수방법' 항목에 해당하는 내용을 그대로 추출합니다.
9. 마이크로티칭 요청사항 (microteachingRequests): 신청서 내 '요청사항' 또는 '마이크로티칭 요청사항'에 해당하는 내용을 그대로 추출합니다.

찾을 수 없는 항목은 모두 빈 문자열("")로 채워 주십시오.

[필수 정규화 규칙]
1. 수업촬영일(shootingDate):
   - 입력된 형식에 무관하게 'YYYY년 MM월 DD일'로 통일합니다.
   - 신청서 내 '수업촬영일'의 '1차 희망일' 날짜 정보를 우선 기준으로 변환해 주십시오 (예: "2025년 9월 17일 9교시" -> "2025년 09월 17일").
   - 1차 희망일 날짜 정보가 없고 2차만 있다면 2차를 기준으로 변환합니다.
   - 연도 정보가 누락되어 '5월 12일'과 같이 월/일만 기재된 경우에는 현재 기준 연도인 '2026년'을 반영하여 '2026년 05월 12일'로 표준화합니다.
   - 촬영일 날짜 정보가 아예 없는 경우 빈 문자열 ""을 적용합니다.
2. 수강인원(studentCount): 숫자만 추출합니다 (예: "30명" -> "30").

반드시 명시된 JSON Schema 구조에 완전하게 맞추어 정규화된 값을 채워 주십시오.`;

          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: contents,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: "application/json",
              responseSchema: applicationSchema,
              temperature: 0.1,
            },
          });

          const jsonText = response.text;
          if (!jsonText) {
            throw new Error("Gemini API가 빈 응답을 반환했습니다.");
          }

          const structuredData = JSON.parse(jsonText.trim());

          results.push({
            fileName: file.originalname,
            status: "success",
            data: structuredData
          });
        } else {
          // Local fallback: extract fields from text without Gemini
          console.log(`[Document Processor] Local fallback parsing: ${file.originalname}`);

          // Filter instruction text (※ lines, blue guide text)
          const cleanText = filterInstructionText(extractedText);

          // Find matching reference knowledge
          const allKnowledge = [...referenceStore.values()].map(r => r.knowledge);
          const matchedKnowledge = findKnownLabels(cleanText, allKnowledge);

          let localData: Record<string, string>;
          if (matchedKnowledge && matchedKnowledge.fieldLabels.length > 0) {
            console.log(`[Document Processor] Using reference knowledge: "${matchedKnowledge.programName}" (${matchedKnowledge.fieldLabels.length} fields)`);
            localData = extractFieldsDynamic(cleanText, matchedKnowledge);
          } else {
            localData = extractFieldsFromText(cleanText) as any;
          }

          results.push({
            fileName: file.originalname,
            status: "success",
            data: localData
          });
        }
      } catch (fileError: any) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        results.push({
          fileName: file.originalname,
          status: "error",
          error: fileError.message || "파일 처리 및 AI 분석 과정에서 오류가 발생했습니다."
        });
      }
    }

    return res.json({ results });

  } catch (error: any) {
    console.error("Global processing error:", error);
    return res.status(500).json({ error: error.message || "서버 내부 처리 중 오류가 발생했습니다." });
  }
});

// Configure Vite middleware and static serving
async function setupServer() {
  if (process.env.NODE_ENV !== "production" && !isVercel) {
    console.log("[Server] Registering Vite development middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!isVercel) {
    console.log("[Server] Serving production static files from dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Server successfully booted and running on http://localhost:${PORT}`);
  });
}

// Only call setupServer when not in serverless (Vercel) context
const isVercel = process.env.VERCEL === '1';
if (!isVercel) {
  setupServer().catch(err => {
    console.error("Failed to start server:", err);
  });
}

export default app;
