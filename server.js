const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('.'));

const AGNES_API_KEY = 'sk-LIjFVb8eqGslR4d5gSFfoQ7owsJJjJohhh3xSadX8t10smUD';
const AGNES_BASE_URL = 'https://apihub.agnes-ai.com/v1';

// =====================
// AGNES TEXT MODEL
// =====================
async function agnesText(prompt, maxTokens = 1000) {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch(`${AGNES_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AGNES_API_KEY}`
    },
    body: JSON.stringify({
      model: 'agnes-2.0-flash',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await res.json();
  console.log('TEXT:', JSON.stringify(data).substring(0, 150));
  return data.choices[0].message.content;
}

// =====================
// AGNES IMAGE MODEL
// =====================
async function agnesImage(prompt) {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch(`${AGNES_BASE_URL}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AGNES_API_KEY}`
    },
    body: JSON.stringify({
      model: 'agnes-image-2.1-flash',
      prompt: prompt,
      n: 1,
      size: '1024x1024'
    })
  });
  const data = await res.json();
  console.log('IMAGE RESPONSE:', JSON.stringify(data).substring(0, 300));
  // Handle different response formats
  const url = data.data?.[0]?.url || data.data?.[0]?.b64_json || data.url || data.image_url || null;
  if (!url) console.error('No image URL found in response:', JSON.stringify(data));
  return url;
}

// =====================
// AGNES VIDEO MODEL
// =====================
async function agnesVideo(prompt) {
  const fetch = (await import('node-fetch')).default;
  console.log('🎬 VIDEO START:', prompt.substring(0, 100));

  const createRes = await fetch(`${AGNES_BASE_URL}/video/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AGNES_API_KEY}`
    },
    body: JSON.stringify({
      model: 'agnes-video-v2.0',
      prompt: prompt,
      height: 480,
      width: 854,
      num_frames: 97,
      frame_rate: 24
    })
  });

  const taskData = await createRes.json();
  console.log('VIDEO TASK:', JSON.stringify(taskData).substring(0, 200));
  const taskId = taskData.id || taskData.task_id || taskData.data?.id;
  if (!taskId) throw new Error('No task ID from Agnes Video');

  // Poll every 5 seconds max 5 mins
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const statusRes = await fetch(`${AGNES_BASE_URL}/video/generations/${taskId}`, {
      headers: { 'Authorization': `Bearer ${AGNES_API_KEY}` }
    });
    const s = await statusRes.json();
    console.log(`POLL ${i+1}:`, JSON.stringify(s).substring(0, 150));
    const status = s.status || s.data?.status;
    const url = s.video_url || s.data?.video_url || s.output?.video_url;
    if (url || status === 'completed') { console.log('✅ VIDEO READY:', url); return url; }
    if (status === 'failed') throw new Error('Video generation failed');
  }
  throw new Error('Video timeout');
}

// =====================
// STEP 2: COMPANY RESEARCH
// =====================
app.post('/api/research-company', async (req, res) => {
  try {
    const { companyName } = req.body;
    const result = await agnesText(`Research the company "${companyName}" thoroughly.
Return ONLY this JSON:
{
  "overview": "2-3 sentence company overview",
  "founded": "year and founders",
  "headquarters": "location",
  "mission": "mission statement",
  "products": "main products or services",
  "culture": "work culture and values",
  "recentNews": "one recent notable news about them",
  "whyJoin": "top 3 reasons to work here",
  "interviewTips": "2 specific interview tips for this company",
  "quizQuestions": [
    {"question": "What does ${companyName} primarily do?", "options": ["A","B","C","D"], "answer": "A"},
    {"question": "When was ${companyName} founded?", "options": ["A","B","C","D"], "answer": "B"},
    {"question": "What is ${companyName} known for?", "options": ["A","B","C","D"], "answer": "A"},
    {"question": "Where is ${companyName} headquartered?", "options": ["A","B","C","D"], "answer": "C"},
    {"question": "What is ${companyName} mission?", "options": ["A","B","C","D"], "answer": "D"}
  ]
}`, 1500);
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    res.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error('Research error:', err);
    res.status(500).json({ error: err.message });
  }
});

// =====================
// STEP 3: RESUME OPTIMIZER → IMAGE
// =====================
app.post('/api/optimize-resume', async (req, res) => {
  try {
    const { resumeText, jobDescText, companyName } = req.body;
    console.log('📄 Resume text received, length:', resumeText?.length || 0);
    console.log('📄 First 100 chars:', resumeText?.substring(0,100));

    if (!resumeText || resumeText.trim().length < 10) {
      console.log('❌ No resume text provided!');
      return res.json({
        name: 'Candidate',
        email: 'your@email.com',
        phone: 'Your phone',
        summary: 'Please provide your resume text for full optimization.',
        skills: ['Communication', 'Teamwork', 'Problem Solving'],
        experience: [],
        education: 'Add your education',
        matchScore: 0,
        addedKeywords: [],
        improvements: ['Upload your resume or paste text in the setup page'],
        imageUrl: null
      });
    }

    console.log('✅ Resume text found! Calling Agnes Text...');

    // Step A: Agnes TEXT rewrites resume
    const optimized = await agnesText(`You are an expert resume writer. Optimize this resume for the role at ${companyName}.

Resume Content:
${resumeText}

Job Description:
${jobDescText || 'Not provided'}

Return ONLY this JSON, no markdown, no backticks, just raw JSON:
{
  "name": "candidate name from resume",
  "email": "email from resume",
  "phone": "phone from resume",
  "summary": "powerful 2-3 sentence professional summary optimized for this role",
  "skills": ["skill1","skill2","skill3","skill4","skill5","skill6","skill7","skill8"],
  "experience": [
    {"title":"job title","company":"company name","duration":"dates","bullets":["achievement 1 with numbers","achievement 2","achievement 3"]}
  ],
  "education": "degree and institution",
  "matchScore": 88,
  "addedKeywords": ["keyword1","keyword2","keyword3","keyword4"],
  "improvements": ["specific improvement 1","specific improvement 2","specific improvement 3"]
}`, 1500);

    console.log('Agnes Text result:', optimized.substring(0,200));

    // Clean and parse JSON
    const cleaned = optimized.replace(/```json/g,'').replace(/```/g,'').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Agnes did not return valid JSON for resume');
    const resumeData = JSON.parse(jsonMatch[0]);
    console.log('✅ Resume parsed! Name:', resumeData.name);

    // Step B: Agnes IMAGE generates resume as image
    const imagePrompt = `A clean professional resume document on white background for ${resumeData.name || 'a professional candidate'}, modern minimalist design with purple and navy color scheme, showing name at top, professional summary section, skills listed as tags, work experience with company names and bullet achievements, education section at bottom. High quality A4 document layout, readable text, professional typography.`;

    console.log('🖼️ Generating resume image...');
    try {
      const imageUrl = await agnesImage(imagePrompt);
      console.log('✅ Image URL:', imageUrl?.substring(0,80));
      res.json({ ...resumeData, imageUrl });
    } catch (imgErr) {
      console.error('❌ Image generation failed:', imgErr.message);
      res.json({ ...resumeData, imageUrl: null });
    }

  } catch (err) {
    console.error('❌ Resume error:', err);
    res.status(500).json({ error: err.message });
  }
});

// =====================
// STEP 4: GENERATE 2 INTERVIEW QUESTIONS + VIDEOS
// =====================
app.post('/api/generate-questions', async (req, res) => {
  try {
    const { companyName, resumeText, jobDescText } = req.body;

    const result = await agnesText(`Generate exactly 2 interview questions.
Company: ${companyName}
Resume: ${resumeText || 'Not provided'}
Job Description: ${jobDescText || 'Not provided'}

Return ONLY this JSON:
{
  "questions": [
    {"id": 1, "type": "personal", "question": "Tell me about yourself and why you want to join ${companyName}?"},
    {"id": 2, "type": "technical", "question": "a specific technical question based on their resume skills and the job requirements"}
  ]
}`, 500);

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    res.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate-videos', async (req, res) => {
  try {
    const { questions, companyName } = req.body;
    const videoUrls = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const prompt = `A professional friendly interviewer, mid 30s, business casual attire, sitting at a modern corporate office desk, warm professional lighting, looking directly at camera with a confident smile, speaking naturally and clearly saying: "${q.question}" — realistic human appearance, natural head movements, professional corporate interview setting, cinematic quality`;

      try {
        console.log(`🎬 Generating interview video ${i+1}/${questions.length}`);
        const url = await agnesVideo(prompt);
        videoUrls.push({ id: q.id, url, question: q.question });
      } catch (e) {
        console.error(`Video ${i+1} failed:`, e.message);
        videoUrls.push({ id: q.id, url: null, question: q.question });
      }
    }

    res.json({ videos: videoUrls });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// STEP 4: FOLLOW UP VIDEO
// =====================
app.post('/api/followup-video', async (req, res) => {
  try {
    const { question, answer, companyName } = req.body;

    // Agnes TEXT generates follow up question
    const textResult = await agnesText(`You are a professional interviewer at ${companyName}.
Asked: "${question}"
Candidate answered: "${answer}"

Generate a smart follow-up based on their specific answer.
Return ONLY JSON:
{
  "followup": "specific follow-up question referencing what they said",
  "feedback": "coaching tip max 8 words",
  "emoji": "✅",
  "suggestedTerms": ["term1","term2"]
}`, 300);

    const jsonMatch = textResult.match(/\{[\s\S]*\}/);
    const followupData = JSON.parse(jsonMatch[0]);

    // Agnes VIDEO generates follow up video
    const videoPrompt = `A professional friendly interviewer, mid 30s, business casual, sitting at corporate desk, warm lighting, looking at camera, nodding thoughtfully after listening, then leaning forward slightly and asking: "${followupData.followup}" — natural human mannerisms, realistic speech, professional setting, cinematic`;

    try {
      const videoUrl = await agnesVideo(videoPrompt);
      res.json({ ...followupData, videoUrl });
    } catch (e) {
      res.json({ ...followupData, videoUrl: null });
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// STEP 5: QUIZ (MCQ)
// =====================
app.post('/api/quiz-result', async (req, res) => {
  try {
    const { score, total, companyName, answers } = req.body;

    // Agnes IMAGE generates quiz result card
    const imagePrompt = `A professional quiz result certificate card, dark navy background, gold and purple accents, showing company knowledge quiz results for ${companyName}, score ${score} out of ${total}, with star rating visualization, clean modern design, certificate style layout`;

    try {
      const imageUrl = await agnesImage(imagePrompt);
      res.json({ imageUrl, score, total });
    } catch (e) {
      res.json({ imageUrl: null, score, total });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// STEP 6: REPORT CARD → IMAGE
// =====================
app.post('/api/final-report', async (req, res) => {
  try {
    const { answers, questions, companyName } = req.body;

    // Agnes TEXT analyses performance
    const textResult = await agnesText(`Analyze these interview answers for a ${companyName} interview:
${answers.map((a, i) => `Q${i+1}: ${questions[i]}\nA: ${a}`).join('\n\n')}

Return ONLY JSON:
{
  "overallScore": 75,
  "contentScore": 80,
  "confidenceScore": 70,
  "bodyLanguageScore": 65,
  "strengths": ["strength1","strength2","strength3"],
  "improvements": ["improvement1","improvement2","improvement3"],
  "verdict": "Ready for interview!",
  "topTip": "single most important tip"
}`, 800);

    const jsonMatch = textResult.match(/\{[\s\S]*\}/);
    const reportData = JSON.parse(jsonMatch[0]);

    // Agnes IMAGE generates report card
    const imagePrompt = `A professional interview performance report card, dark background with purple and blue gradients, showing overall score ${reportData.overallScore}% in large text, circular progress indicators for Content ${reportData.contentScore}%, Confidence ${reportData.confidenceScore}%, Body Language ${reportData.bodyLanguageScore}%, strengths and improvements sections, modern dashboard design, InterviewIQ branding`;

    try {
      const imageUrl = await agnesImage(imagePrompt);
      res.json({ ...reportData, imageUrl });
    } catch (e) {
      res.json({ ...reportData, imageUrl: null });
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// STEP 7: MODEL ANSWER VIDEO
// =====================
app.post('/api/model-answer', async (req, res) => {
  try {
    const { question, userAnswer, companyName } = req.body;

    // Agnes TEXT generates ideal answer
    const idealAnswer = await agnesText(`You are an expert interview coach for ${companyName}.
The question was: "${question}"
The candidate answered: "${userAnswer}"

Write a perfect model answer for this question using STAR method.
Include natural human speech patterns, pauses, and natural improvisation.
Keep it 2-3 paragraphs, conversational and confident.
Return ONLY JSON:
{
  "modelAnswer": "the complete ideal answer with natural speech...",
  "keyPoints": ["key point 1","key point 2","key point 3"],
  "improvements": "what candidate should improve"
}`, 800);

    const jsonMatch = idealAnswer.match(/\{[\s\S]*\}/);
    const answerData = JSON.parse(jsonMatch[0]);

    // Agnes VIDEO generates model answer video
    // This is the KEY feature — real human-like AI person demonstrating the answer
    const videoPrompt = `A highly confident professional job candidate, late 20s to early 30s, business casual attire, sitting upright at a desk in a bright modern office, making natural eye contact with camera, speaking with genuine enthusiasm and natural human body language including: slight head nods, natural hand gestures, thoughtful pauses, warm smile, saying: "${answerData.modelAnswer.substring(0, 400)}" — realistic human speech patterns, natural improvisation style, confident posture, cinematic professional quality`;

    try {
      console.log('🎬 Generating MODEL ANSWER video (Step 7)...');
      const videoUrl = await agnesVideo(videoPrompt);
      res.json({ ...answerData, videoUrl });
    } catch (e) {
      console.error('Model answer video failed:', e.message);
      res.json({ ...answerData, videoUrl: null });
    }

  } catch (err) {
    console.error('Model answer error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log('🚀 InterviewIQ — Employde 5');
  console.log('📝 Text Model: Research, Questions, Resume, Report');
  console.log('🖼️  Image Model: Resume, Quiz Card, Report Card');
  console.log('🎬 Video Model: Interview Qs, Follow Up, Model Answer');
});
