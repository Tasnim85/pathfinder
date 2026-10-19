import type { Report } from "./schemas";
// DEMO DATA ONLY. Invented to show the interface when the AI service is not connected.
export const MOCK_TRANSCRIPT = "Hi, I am a software engineer with about six years of experience building web applications. I work mostly with Python, Django and PostgreSQL, and I have used AWS and Docker to deploy services. I studied computer science at university. I am now looking for a backend or full stack role where I can work on data heavy products.";
export const MOCK_REPORT: Report = {
  cv_id: "demo_cv", generated_at: "17/10/2026 10:00", query: "software engineer python django postgresql aws", grader_accepted: true, iterations: 1, pool_size: 7,
  model: "7b", confidence: "high", conf_reasons: [], seconds: 94, input_type: "cv",
  weights: { title: 0.25, skills_llm: 0.25, experience: 0.15, retrieval: 0.15, skills_lex: 0.1, education: 0.1 },
  profile: { target_title: "Software Engineer", summary: "Backend-leaning engineer with web application experience.", skills: ["Python", "Django", "PostgreSQL", "AWS", "Docker", "REST APIs"], years_experience: 6, education: ["BSc Computer Science"], experiences: [{ title: "Software Engineer", company: "Example Co", duration: "2020 - 2026" }] },
  summary: "Ce rapport est une démonstration : il illustre la mise en page des résultats lorsque le service d'IA n'est pas connecté.\n\nLe poste n°1 correspond le mieux au profil grâce à Python et PostgreSQL ; le n°2 demande davantage de front-end.",
  top: [
    { doc_id: "demo_1", rank: 1, title: "Senior Python Backend Developer", location: "Remote", employment_type: "Full-time", function: "Information Technology", required_experience: "Mid-Senior level", required_education: "Bachelor's Degree", excerpt: "Strong Python and SQL skills. Experience with REST APIs and cloud deployment. Familiarity with Docker.", score: 81.4,
      components: { title: 1, skills_llm: 0.8, experience: 1, retrieval: 0.72, skills_lex: 0.55, education: 1 }, matched: ["Python", "PostgreSQL", "Docker", "REST APIs"], missing: ["Kubernetes"], reasoning: "Profil très proche du poste ; seule la maîtrise de Kubernetes n'apparaît pas dans le CV.", llm_ok: true },
    { doc_id: "demo_2", rank: 2, title: "Full Stack Engineer", location: "Berlin, DE", employment_type: "Full-time", function: "Engineering", required_experience: "Mid-Senior level", required_education: "Bachelor's Degree", excerpt: "React and Node.js experience, plus a relational database. Ownership of features end to end.", score: 63.2,
      components: { title: 0.8, skills_llm: 0.6, experience: 1, retrieval: 0.6, skills_lex: 0.3, education: 1 }, matched: ["PostgreSQL", "REST APIs"], missing: ["React", "Node.js"], reasoning: "Compétences back-end pertinentes mais le poste exige du front-end non mentionné.", llm_ok: true },
    { doc_id: "demo_3", rank: 3, title: "Data Platform Engineer", location: "London, GB", employment_type: "Contract", function: "Information Technology", required_experience: null, required_education: "Master's Degree", excerpt: "Build data pipelines on cloud infrastructure. Spark and Airflow are a plus.", score: 47.9,
      components: { title: 0.6, skills_llm: 0.4, experience: null, retrieval: 0.55, skills_lex: 0.25, education: 0.5 }, matched: ["Python", "AWS"], missing: ["Spark", "Airflow"], reasoning: "Rapprochement partiel : les outils de pipeline de données ne figurent pas au CV.", llm_ok: true },
  ],
};
