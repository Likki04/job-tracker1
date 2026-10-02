import re

SKILLS: dict[str, list[str]] = {
    "Python": [], "JavaScript": ["js"], "TypeScript": ["ts"], "Java": [], "C++": [], "C#": [],
    "Go": ["golang"], "Rust": [], "SQL": [], "PostgreSQL": ["postgres"], "MySQL": [], "MongoDB": [],
    "Redis": [], "React": ["react.js", "reactjs"], "Angular": [], "Vue": ["vue.js"], "Node.js": ["node", "nodejs"],
    "Express": [], "FastAPI": [], "Django": [], "Flask": [], "Spring Boot": ["spring"], "HTML": ["html5"],
    "CSS": ["css3"], "Tailwind": ["tailwindcss"], "Docker": [], "Kubernetes": ["k8s"], "AWS": ["amazon web services"],
    "Azure": [], "GCP": ["google cloud"], "Git": ["github", "gitlab"], "CI/CD": ["jenkins", "github actions"],
    "Linux": [], "REST": ["restful", "rest api"], "GraphQL": [], "Machine Learning": ["ml"],
    "Deep Learning": [], "NLP": ["natural language processing"], "Pandas": [], "NumPy": [],
    "TensorFlow": [], "PyTorch": [], "Scikit-learn": ["sklearn"], "Data Analysis": ["data analytics"],
    "Tableau": [], "Power BI": [], "Excel": [], "Agile": [], "Scrum": [], "Jira": [], "Testing": ["pytest", "jest", "unit tests"],
    "Microservices": [], "Kafka": [], "Terraform": [], "Communication": [], "Leadership": [],
    "Problem Solving": ["problem-solving"], "Redux": [], "Next.js": ["nextjs"], "Selenium": [], "Spark": ["pyspark"],
}

def _pattern(term: str) -> re.Pattern:
    return re.compile(r"(?<![\w+#.])" + re.escape(term) + r"(?![\w+#])", re.I)

_PATTERNS = {name: [_pattern(t) for t in [name, *aliases]] for name, aliases in SKILLS.items()}

def extract_skills(text: str) -> list[str]:
    return [n for n, pats in _PATTERNS.items() if any(p.search(text or "") for p in pats)]

def canonical(name: str) -> str:
    """Map a user-typed skill (or alias) to its canonical name."""
    low = name.strip().lower()
    for n, aliases in SKILLS.items():
        if low == n.lower() or low in aliases:
            return n
    return name.strip()
