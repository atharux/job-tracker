import { supabase } from '../supabaseClient'
import type { TailoredResume, CoverLetter } from './types'

// ── Types ──────────────────────────────────────────────────────────────────

interface ContactInfo {
  name: string
  email: string
  phone?: string
  linkedin?: string
  portfolio?: string
  location?: string
}

export interface SubmissionResult {
  success: boolean
  method: 'greenhouse' | 'lever' | 'smartrecruiters' | 'recruitee' | 'manual'
  message: string
  reference?: string
  applicationUrl: string
  requiresManual: boolean
}

export interface JobForSubmission {
  id: string
  title: string
  company: string
  url: string
  source: string
}

// ── Resume text formatter ──────────────────────────────────────────────────

function formatResumeAsText(resume: TailoredResume, contact: ContactInfo): string {
  const lines: string[] = []

  lines.push(contact.name.toUpperCase())
  lines.push([contact.email, contact.phone, contact.location].filter(Boolean).join(' | '))
  if (contact.linkedin || contact.portfolio) {
    lines.push([contact.linkedin, contact.portfolio].filter(Boolean).join(' | '))
  }
  lines.push('')

  if (resume.summary) {
    lines.push('SUMMARY')
    lines.push('─'.repeat(60))
    lines.push(resume.summary)
    lines.push('')
  }

  if (resume.experience?.length) {
    lines.push('EXPERIENCE')
    lines.push('─'.repeat(60))
    for (const exp of resume.experience) {
      lines.push(`${exp.company} | ${exp.role}${exp.dates ? ` | ${exp.dates}` : ''}`)
      for (const bullet of exp.bullets) lines.push(`  • ${bullet}`)
      lines.push('')
    }
  }

  if (resume.skills?.length) {
    lines.push('SKILLS')
    lines.push('─'.repeat(60))
    lines.push(resume.skills.join(', '))
    lines.push('')
  }

  if (resume.education?.length) {
    lines.push('EDUCATION')
    lines.push('─'.repeat(60))
    for (const edu of resume.education) {
      lines.push(`${edu.degree} — ${edu.institution}, ${edu.location} (${edu.year})`)
    }
    lines.push('')
  }

  if (resume.languages?.length) {
    lines.push('LANGUAGES')
    lines.push('─'.repeat(60))
    lines.push(resume.languages.map(l => `${l.language} (${l.level})`).join(', '))
    lines.push('')
  }

  if (resume.certifications?.length) {
    lines.push('CERTIFICATIONS')
    lines.push('─'.repeat(60))
    for (const cert of resume.certifications) {
      lines.push(`${cert.name} — ${cert.issuer} (${cert.year})`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ── Contact loader ─────────────────────────────────────────────────────────

export async function loadContact(userId: string): Promise<ContactInfo> {
  const { data } = await supabase
    .from('cv_versions')
    .select('content')
    .eq('user_id', userId)
    .limit(1)
    .single()

  const contact = (data?.content as Record<string, unknown>)?.contact as ContactInfo | undefined
  if (contact?.name && contact?.email) return contact

  // Fallback to hardcoded values if cv_versions not yet seeded
  return {
    name: 'Athar Hafiz',
    email: 'athar.hafiz@gmail.com',
    phone: '+49 177 2763088',
    location: 'Berlin, Germany',
    linkedin: 'https://www.linkedin.com/in/atharhafiz',
    portfolio: 'https://atharux.com',
  }
}

// ── URL parsers ────────────────────────────────────────────────────────────

function parseGreenhouseUrl(url: string): { boardToken: string; jobId: string } | null {
  const m = url.match(/greenhouse\.io\/([^/?#]+)\/jobs\/(\d+)/)
  return m ? { boardToken: m[1], jobId: m[2] } : null
}

function parseLeverUrl(url: string): string | null {
  const m = url.match(/lever\.co\/[^/?#]+\/([a-f0-9-]{36})/i)
  return m ? m[1] : null
}

function parseSmartRecruitersJobId(url: string): string | null {
  // https://jobs.smartrecruiters.com/DeliveryHero/743999001234567-title
  const m = url.match(/smartrecruiters\.com\/[^/?#]+\/(\d+)/)
  return m ? m[1] : null
}

function parseRecruiteeUrl(url: string): { companySlug: string; offerSlug: string } | null {
  const m = url.match(/([^.]+)\.recruitee\.com\/o\/([^?#/]+)/)
  return m ? { companySlug: m[1], offerSlug: m[2] } : null
}

// ── Per-ATS submitters ─────────────────────────────────────────────────────

async function submitToGreenhouse(
  job: JobForSubmission,
  resume: TailoredResume,
  letter: CoverLetter,
  contact: ContactInfo
): Promise<SubmissionResult> {
  const parsed = parseGreenhouseUrl(job.url)
  if (!parsed) {
    return { success: false, method: 'greenhouse', message: 'Could not parse Greenhouse URL', applicationUrl: job.url, requiresManual: true }
  }

  const { boardToken, jobId } = parsed
  const resumeText = formatResumeAsText(resume, contact)
  const [firstName, ...rest] = contact.name.split(' ')
  const lastName = rest.join(' ') || ''

  const form = new FormData()
  form.append('first_name', firstName)
  form.append('last_name', lastName)
  form.append('email', contact.email)
  if (contact.phone) form.append('phone', contact.phone)
  form.append('resume', new Blob([resumeText], { type: 'text/plain' }), 'athar_hafiz_resume.txt')
  form.append('cover_letter', new Blob([letter.body], { type: 'text/plain' }), 'athar_hafiz_cover_letter.txt')

  try {
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${jobId}/applications`,
      { method: 'POST', body: form }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, string>
      return { success: false, method: 'greenhouse', message: `Greenhouse: ${err.message ?? res.status}`, applicationUrl: job.url, requiresManual: true }
    }
    const data = await res.json() as Record<string, unknown>
    return {
      success: true,
      method: 'greenhouse',
      message: `Submitted to ${job.company} via Greenhouse`,
      reference: data.id ? String(data.id) : undefined,
      applicationUrl: job.url,
      requiresManual: false,
    }
  } catch (err) {
    return { success: false, method: 'greenhouse', message: `Greenhouse: ${(err as Error).message}`, applicationUrl: job.url, requiresManual: true }
  }
}

async function submitToLever(
  job: JobForSubmission,
  resume: TailoredResume,
  letter: CoverLetter,
  contact: ContactInfo
): Promise<SubmissionResult> {
  const postingId = parseLeverUrl(job.url)
  if (!postingId) {
    return { success: false, method: 'lever', message: 'Could not parse Lever posting ID', applicationUrl: job.url, requiresManual: true }
  }

  const resumeText = formatResumeAsText(resume, contact)

  const form = new FormData()
  form.append('name', contact.name)
  form.append('email', contact.email)
  if (contact.phone) form.append('phone', contact.phone)
  form.append('resume', new Blob([resumeText], { type: 'text/plain' }), 'athar_hafiz_resume.txt')
  form.append('comments', letter.body)
  if (contact.linkedin) form.append('urls[LinkedIn]', contact.linkedin)
  if (contact.portfolio) form.append('urls[Portfolio]', contact.portfolio)

  try {
    const res = await fetch(
      `https://api.lever.co/v0/postings/${postingId}/apply`,
      { method: 'POST', body: form }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, string>
      return { success: false, method: 'lever', message: `Lever: ${err.error ?? res.status}`, applicationUrl: job.url, requiresManual: true }
    }
    const data = await res.json() as Record<string, unknown>
    return {
      success: true,
      method: 'lever',
      message: `Submitted to ${job.company} via Lever`,
      reference: data.applicationId ? String(data.applicationId) : undefined,
      applicationUrl: job.url,
      requiresManual: false,
    }
  } catch (err) {
    return { success: false, method: 'lever', message: `Lever: ${(err as Error).message}`, applicationUrl: job.url, requiresManual: true }
  }
}

async function submitToSmartRecruiters(
  job: JobForSubmission,
  resume: TailoredResume,
  letter: CoverLetter,
  contact: ContactInfo
): Promise<SubmissionResult> {
  const jobId = parseSmartRecruitersJobId(job.url)
  if (!jobId) {
    return { success: false, method: 'smartrecruiters', message: 'Could not parse SmartRecruiters job ID', applicationUrl: job.url, requiresManual: true }
  }

  const resumeText = formatResumeAsText(resume, contact)
  const resumeBase64 = btoa(unescape(encodeURIComponent(resumeText)))
  const [firstName, ...rest] = contact.name.split(' ')

  const body = {
    firstName,
    lastName: rest.join(' ') || '',
    email: contact.email,
    phoneNumber: contact.phone ?? '',
    bio: letter.body,
    attachment: {
      fileName: 'athar_hafiz_resume.txt',
      fileType: 'text/plain',
      fileContent: resumeBase64,
    },
  }

  try {
    const res = await fetch(
      `https://api.smartrecruiters.com/jobs/${jobId}/application`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, string>
      return { success: false, method: 'smartrecruiters', message: `SmartRecruiters: ${err.message ?? res.status}`, applicationUrl: job.url, requiresManual: true }
    }
    return {
      success: true,
      method: 'smartrecruiters',
      message: `Submitted to ${job.company} via SmartRecruiters`,
      applicationUrl: job.url,
      requiresManual: false,
    }
  } catch (err) {
    return { success: false, method: 'smartrecruiters', message: `SmartRecruiters: ${(err as Error).message}`, applicationUrl: job.url, requiresManual: true }
  }
}

async function submitToRecruitee(
  job: JobForSubmission,
  resume: TailoredResume,
  letter: CoverLetter,
  contact: ContactInfo
): Promise<SubmissionResult> {
  const parsed = parseRecruiteeUrl(job.url)
  if (!parsed) {
    return { success: false, method: 'recruitee', message: 'Could not parse Recruitee URL', applicationUrl: job.url, requiresManual: true }
  }

  const { companySlug, offerSlug } = parsed

  try {
    const offersRes = await fetch(`https://${companySlug}.recruitee.com/api/offers/`)
    if (!offersRes.ok) throw new Error(`offers list ${offersRes.status}`)

    const offersData = await offersRes.json() as { offers: Array<{ id: number; slug: string }> }
    const offer = offersData.offers.find(o => job.url.includes(o.slug) || o.slug === offerSlug)
    if (!offer) throw new Error('offer not found in list')

    const resumeText = formatResumeAsText(resume, contact)
    const form = new FormData()
    form.append('candidate[name]', contact.name)
    form.append('candidate[email]', contact.email)
    if (contact.phone) form.append('candidate[phone]', contact.phone)
    form.append('candidate[cover_letter]', letter.body)
    form.append('candidate[cv]', new Blob([resumeText], { type: 'text/plain' }), 'athar_hafiz_resume.txt')

    const res = await fetch(
      `https://${companySlug}.recruitee.com/api/offers/${offer.id}/apply`,
      { method: 'POST', body: form }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, string>
      return { success: false, method: 'recruitee', message: `Recruitee: ${err.message ?? res.status}`, applicationUrl: job.url, requiresManual: true }
    }
    return {
      success: true,
      method: 'recruitee',
      message: `Submitted to ${job.company} via Recruitee`,
      applicationUrl: job.url,
      requiresManual: false,
    }
  } catch (err) {
    return { success: false, method: 'recruitee', message: `Recruitee: ${(err as Error).message}`, applicationUrl: job.url, requiresManual: true }
  }
}

// ── Main dispatch ──────────────────────────────────────────────────────────

export async function submitApplication(
  job: JobForSubmission,
  resume: TailoredResume,
  letter: CoverLetter,
  userId: string
): Promise<SubmissionResult> {
  const contact = await loadContact(userId)

  switch (job.source) {
    case 'greenhouse':
      return submitToGreenhouse(job, resume, letter, contact)
    case 'lever':
      return submitToLever(job, resume, letter, contact)
    case 'smartrecruiters':
      return submitToSmartRecruiters(job, resume, letter, contact)
    case 'recruitee':
      return submitToRecruitee(job, resume, letter, contact)
    default:
      return {
        success: false,
        method: 'manual',
        message: `${job.source} does not support API submission — use the link to apply manually with your documents`,
        applicationUrl: job.url,
        requiresManual: true,
      }
  }
}
