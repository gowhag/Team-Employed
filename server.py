import os
from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import json
from openai import OpenAI

load_dotenv()
app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

agnes_api_key = os.getenv("AGNES_API_KEY")
if not agnes_api_key:
    raise RuntimeError("AGNES_API_KEY is required in environment variables")

client = OpenAI(api_key=agnes_api_key, base_url="https://apihub.agnes-ai.com/v1")

MODEL_NAME = "agnes-2.0-flash"


def generate_analysis(prompt: str):
    response = client.responses.create(
        model=MODEL_NAME,
        input=prompt,
        max_tokens=600,
        temperature=0.4,
    )
    if response is None:
        return ""
    if hasattr(response, "output_text") and response.output_text:
        return response.output_text
    if hasattr(response, "output"):
        return "\n".join([str(item) for item in response.output])
    return ""

def parse_response_to_json(raw: str):
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        try:
            body = raw[raw.index("{") : raw.rindex("}") + 1]
            return json.loads(body)
        except Exception:
            return {
                "summary": raw.strip(),
                "keywords": [],
                "questions": [],
            }

@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


@app.route("/api/parse", methods=["POST"])
def parse_documents():
    resume_text = request.form.get("resumeText", "")
    job_text = request.form.get("jobText", "")

    uploaded_resume = request.files.get("resumeFile")
    uploaded_job = request.files.get("jobFile")

    if uploaded_resume:
        resume_text += "\n" + uploaded_resume.read().decode("utf-8", errors="ignore")
    if uploaded_job:
        job_text += "\n" + uploaded_job.read().decode("utf-8", errors="ignore")

    prompt = (
        "You are an elite interview coaching engine. Extract industry-specific keywords, core strengths, hiring triggers, "
        "and generate 5 high-stakes interview questions based on the candidate resume and target job description. "
        "Return a valid JSON object with fields: summary, keywords, questions. "
        "Keywords should be a short list of terms, questions should be an array of concise interview prompts. "
        f"\n\nResume:\n{resume_text}\n\nJob Description:\n{job_text}\n"
    )

    analysis = generate_analysis(prompt)
    parsed = parse_response_to_json(analysis)

    return jsonify(
        success=True,
        resumeSummary=resume_text[:800],
        jobSummary=job_text[:800],
        insights=analysis,
        parsed=parsed,
    )


@app.route("/api/realtime-feedback", methods=["GET"])
def realtime_feedback():
    return jsonify(
        status="green",
        emoji="😊",
        topPrompt="Keep your eyes on the lens. Mention your industry keywords naturally.",
        coachingKeywords=[
            "stakeholder alignment",
            "cross-functional execution",
            "growth mindset",
            "data-driven impact",
        ],
        checklist={
            "posture": False,
            "expression": True,
            "contentAccuracy": False,
            "keywordInsertion": False,
        },
    )


@app.route("/api/review", methods=["POST"])
def review_session():
    transcript = request.json.get("transcript", "")
    prompt = (
        "You are an elite interview performance analyst. "
        "Analyze the transcript and deliver: filler word counts, structural answer score, missed keyword opportunities, "
        "confidence suggestions, and a concise coaching summary for a post-interview review panel. "
        f"Transcript:\n{transcript}\n"
    )

    review = generate_analysis(prompt)

    return jsonify(
        success=True,
        textAnalytics={
            "fillerWords": {"um": 5, "uh": 3, "like": 2},
            "structureScore": 78,
            "keywordMisses": ["strategic alignment", "executive communication"],
            "reviewSummary": review,
        },
        diagnostics=[
            {"timestamp": 12, "issue": "Posture dip", "severity": "medium"},
            {"timestamp": 27, "issue": "Filler repetition", "severity": "low"},
        ],
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
