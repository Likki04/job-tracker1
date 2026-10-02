from datetime import date, datetime
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict
from sqlalchemy import ForeignKey, Text, create_engine, or_
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

from skills import canonical, extract_skills

STATUSES = ["Applied", "Screening", "Assessment", "Interview", "Offer", "Rejected"]
engine = create_engine("sqlite:///jobs.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Resume(Base):
    __tablename__ = "resumes"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    notes: Mapped[str] = mapped_column(Text, default="")


class Skill(Base):
    __tablename__ = "skills"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(unique=True)


class Interview(Base):
    __tablename__ = "interviews"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"))
    round: Mapped[str]
    scheduled_at: Mapped[Optional[datetime]]
    notes: Mapped[str] = mapped_column(Text, default="")


class Application(Base):
    __tablename__ = "applications"
    id: Mapped[int] = mapped_column(primary_key=True)
    company: Mapped[str]
    role: Mapped[str]
    location: Mapped[str] = mapped_column(default="")
    salary: Mapped[str] = mapped_column(default="")
    status: Mapped[str] = mapped_column(default="Applied")
    applied_date: Mapped[date]
    deadline: Mapped[Optional[date]]
    job_description: Mapped[str] = mapped_column(Text, default="")
    resume_id: Mapped[Optional[int]] = mapped_column(ForeignKey("resumes.id"))
    interviews: Mapped[list[Interview]] = relationship(
        cascade="all, delete-orphan", order_by=Interview.scheduled_at, lazy="selectin"
    )


Base.metadata.create_all(engine)


class ApplicationIn(BaseModel):
    company: str
    role: str
    location: str = ""
    salary: str = ""
    status: str = "Applied"
    applied_date: date
    deadline: Optional[date] = None
    job_description: str = ""
    resume_id: Optional[int] = None


class InterviewIn(BaseModel):
    round: str
    scheduled_at: Optional[datetime] = None
    notes: str = ""


class InterviewOut(InterviewIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    application_id: int


class ApplicationOut(ApplicationIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    interviews: list[InterviewOut] = []


class ResumeIn(BaseModel):
    name: str
    notes: str = ""


class ResumeOut(ResumeIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class SkillIn(BaseModel):
    name: str


class SkillOut(SkillIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class TextIn(BaseModel):
    text: str


def get_db():
    with SessionLocal() as db:
        yield db


app = FastAPI(title="Job Application & Interview Tracker")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def get_or_404(db: Session, model, id: int):
    obj = db.get(model, id)
    if not obj:
        raise HTTPException(404, f"{model.__name__} not found")
    return obj


def check_status(s: str):
    if s not in STATUSES:
        raise HTTPException(422, f"status must be one of {STATUSES}")


# ---------- Applications ----------
@app.get("/api/applications", response_model=list[ApplicationOut])
def list_applications(q: str = "", status: str = "", db: Session = Depends(get_db)):
    query = db.query(Application)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Application.company.ilike(like), Application.role.ilike(like),
                                 Application.location.ilike(like), Application.job_description.ilike(like)))
    if status:
        query = query.filter(Application.status == status)
    return query.order_by(Application.applied_date.desc(), Application.id.desc()).all()


@app.post("/api/applications", response_model=ApplicationOut, status_code=201)
def create_application(body: ApplicationIn, db: Session = Depends(get_db)):
    check_status(body.status)
    obj = Application(**body.model_dump())
    db.add(obj)
    db.commit()
    return obj


@app.get("/api/applications/{id}", response_model=ApplicationOut)
def get_application(id: int, db: Session = Depends(get_db)):
    return get_or_404(db, Application, id)


@app.put("/api/applications/{id}", response_model=ApplicationOut)
def update_application(id: int, body: ApplicationIn, db: Session = Depends(get_db)):
    check_status(body.status)
    obj = get_or_404(db, Application, id)
    for k, v in body.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    return obj


@app.delete("/api/applications/{id}", status_code=204)
def delete_application(id: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, Application, id))
    db.commit()


# ---------- Interviews ----------
@app.post("/api/applications/{id}/interviews", response_model=InterviewOut, status_code=201)
def add_interview(id: int, body: InterviewIn, db: Session = Depends(get_db)):
    get_or_404(db, Application, id)
    obj = Interview(application_id=id, **body.model_dump())
    db.add(obj)
    db.commit()
    return obj


@app.put("/api/interviews/{id}", response_model=InterviewOut)
def update_interview(id: int, body: InterviewIn, db: Session = Depends(get_db)):
    obj = get_or_404(db, Interview, id)
    for k, v in body.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    return obj


@app.delete("/api/interviews/{id}", status_code=204)
def delete_interview(id: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, Interview, id))
    db.commit()


# ---------- Resumes & skills ----------
@app.get("/api/resumes", response_model=list[ResumeOut])
def list_resumes(db: Session = Depends(get_db)):
    return db.query(Resume).order_by(Resume.id).all()


@app.post("/api/resumes", response_model=ResumeOut, status_code=201)
def add_resume(body: ResumeIn, db: Session = Depends(get_db)):
    obj = Resume(**body.model_dump())
    db.add(obj)
    db.commit()
    return obj


@app.delete("/api/resumes/{id}", status_code=204)
def delete_resume(id: int, db: Session = Depends(get_db)):
    db.query(Application).filter(Application.resume_id == id).update({"resume_id": None})
    db.delete(get_or_404(db, Resume, id))
    db.commit()


@app.get("/api/skills", response_model=list[SkillOut])
def list_skills(db: Session = Depends(get_db)):
    return db.query(Skill).order_by(Skill.name).all()


@app.post("/api/skills", response_model=SkillOut, status_code=201)
def add_skill(body: SkillIn, db: Session = Depends(get_db)):
    name = canonical(body.name)
    if not name:
        raise HTTPException(422, "Skill name is empty")
    existing = db.query(Skill).filter(Skill.name.ilike(name)).first()
    if existing:
        return existing
    obj = Skill(name=name)
    db.add(obj)
    db.commit()
    return obj


@app.delete("/api/skills/{id}", status_code=204)
def delete_skill(id: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, Skill, id))
    db.commit()


# ---------- Skill extraction & matching ----------
def compare(db: Session, text: str):
    extracted = extract_skills(text)
    mine = {s.name.lower() for s in db.query(Skill).all()}
    matched = [s for s in extracted if s.lower() in mine]
    missing = [s for s in extracted if s.lower() not in mine]
    score = round(100 * len(matched) / len(extracted)) if extracted else 0
    return {"extracted": extracted, "matched": matched, "missing": missing, "score": score}


@app.post("/api/extract-skills")
def extract(body: TextIn, db: Session = Depends(get_db)):
    return compare(db, body.text)


@app.get("/api/applications/{id}/skill-match")
def skill_match(id: int, db: Session = Depends(get_db)):
    return compare(db, get_or_404(db, Application, id).job_description)


# ---------- Dashboard ----------
@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)):
    apps = db.query(Application).all()
    today = date.today()
    total = len(apps)
    by_status = {s: sum(a.status == s for a in apps) for s in STATUSES}
    upcoming = (db.query(Interview, Application).join(Application)
                .filter(Interview.scheduled_at >= datetime.now()).order_by(Interview.scheduled_at).limit(5).all())
    return {
        "total": total,
        "this_month": sum(a.applied_date.year == today.year and a.applied_date.month == today.month for a in apps),
        "interviews": db.query(Interview).count(),
        "offers": by_status["Offer"],
        "rejection_rate": round(100 * by_status["Rejected"] / total, 1) if total else 0,
        "by_status": by_status,
        "upcoming": [{"id": i.id, "application_id": a.id, "company": a.company, "role": a.role, "round": i.round,
                      "scheduled_at": i.scheduled_at.isoformat()} for i, a in upcoming],
    }


# In production, Render serves the compiled React app from this FastAPI service.
frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
