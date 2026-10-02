export const STATUSES = ['Applied', 'Screening', 'Assessment', 'Interview', 'Offer', 'Rejected'] as const
export type Status = (typeof STATUSES)[number]

export interface Interview { id: number; application_id: number; round: string; scheduled_at: string | null; notes: string }
export interface Job {
  id: number; company: string; role: string; location: string; salary: string; status: Status
  applied_date: string; deadline: string | null; job_description: string; resume_id: number | null
  interviews: Interview[]
}
export type JobIn = Omit<Job, 'id' | 'interviews'>
export interface Resume { id: number; name: string; notes: string }
export interface Skill { id: number; name: string }
export interface Match { extracted: string[]; matched: string[]; missing: string[]; score: number }
export interface Dash {
  total: number; this_month: number; interviews: number; offers: number; rejection_rate: number
  by_status: Record<string, number>
  upcoming: { id: number; application_id: number; company: string; role: string; round: string; scheduled_at: string }[]
}
