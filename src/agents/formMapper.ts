import { callAI, getPreferredFreeModel } from './openRouterClient'
import type { FormMapping, FormField } from './types'

// Detect ATS platform from URL — determines which standard fields to expect
function detectATS(url: string): string {
  if (/greenhouse\.io/i.test(url)) return 'Greenhouse'
  if (/lever\.co/i.test(url)) return 'Lever'
  if (/ashbyhq\.com|ashby\.io/i.test(url)) return 'Ashby'
  if (/workable\.com/i.test(url)) return 'Workable'
  if (/smartrecruiters\.com/i.test(url)) return 'SmartRecruiters'
  if (/recruitee\.com/i.test(url)) return 'Recruitee'
  if (/bamboohr\.com/i.test(url)) return 'BambooHR'
  if (/linkedin\.com/i.test(url)) return 'LinkedIn'
  if (/jobs\.lever\.co/i.test(url)) return 'Lever'
  if (/apply\.workable/i.test(url)) return 'Workable'
  return 'Generic'
}

// Standard field sets per ATS platform
const ATS_BASE_FIELDS: Record<string, Array<Omit<FormField, 'value'>>> = {
  Greenhouse: [
    { label: 'First Name',      field_name: 'first_name',     field_type: 'text',     confidence: 1.0, requires_manual: false },
    { label: 'Last Name',       field_name: 'last_name',      field_type: 'text',     confidence: 1.0, requires_manual: false },
    { label: 'Email',           field_name: 'email',          field_type: 'email',    confidence: 1.0, requires_manual: false },
    { label: 'Phone',           field_name: 'phone',          field_type: 'tel',      confidence: 1.0, requires_manual: false },
    { label: 'Resume / CV',     field_name: 'resume',         field_type: 'file',     confidence: 1.0, requires_manual: true  },
    { label: 'LinkedIn URL',    field_name: 'linkedin_url',   field_type: 'url',      confidence: 0.9, requires_manual: false },
    { label: 'Website / Portfolio', field_name: 'website',   field_type: 'url',      confidence: 0.8, requires_manual: false },
    { label: 'Cover Letter',    field_name: 'cover_letter',   field_type: 'textarea', confidence: 0.8, requires_manual: false },
  ],
  Lever: [
    { label: 'Full Name',       field_name: 'name',           field_type: 'text',     confidence: 1.0, requires_manual: false },
    { label: 'Email',           field_name: 'email',          field_type: 'email',    confidence: 1.0, requires_manual: false },
    { label: 'Phone',           field_name: 'phone',          field_type: 'tel',      confidence: 1.0, requires_manual: false },
    { label: 'Current Company', field_name: 'org',            field_type: 'text',     confidence: 0.9, requires_manual: false },
    { label: 'Resume / CV',     field_name: 'resume',         field_type: 'file',     confidence: 1.0, requires_manual: true  },
    { label: 'LinkedIn URL',    field_name: 'urls[LinkedIn]', field_type: 'url',      confidence: 0.9, requires_manual: false },
    { label: 'Portfolio / Website', field_name: 'urls[Portfolio]', field_type: 'url', confidence: 0.8, requires_manual: false },
    { label: 'Additional Info', field_name: 'comments',       field_type: 'textarea', confidence: 0.7, requires_manual: false },
  ],
  Ashby: [
    { label: 'First Name',      field_name: 'first_name',     field_type: 'text',     confidence: 1.0, requires_manual: false },
    { label: 'Last Name',       field_name: 'last_name',      field_type: 'text',     confidence: 1.0, requires_manual: false },
    { label: 'Email',           field_name: 'email',          field_type: 'email',    confidence: 1.0, requires_manual: false },
    { label: 'Phone',           field_name: 'phone',          field_type: 'tel',      confidence: 0.9, requires_manual: false },
    { label: 'Resume / CV',     field_name: 'resume',         field_type: 'file',     confidence: 1.0, requires_manual: true  },
    { label: 'LinkedIn URL',    field_name: 'linkedin',       field_type: 'url',      confidence: 0.9, requires_manual: false },
    { label: 'Portfolio',       field_name: 'portfolio',      field_type: 'url',      confidence: 0.8, requires_manual: false },
    { label: 'Cover Letter',    field_name: 'cover_letter',   field_type: 'textarea', confidence: 0.8, requires_manual: false },
  ],
  SmartRecruiters: [
    { label: 'First Name',      field_name: 'firstName',      field_type: 'text',     confidence: 1.0, requires_manual: false },
    { label: 'Last Name',       field_name: 'lastName',       field_type: 'text',     confidence: 1.0, requires_manual: false },
    { label: 'Email',           field_name: 'email',          field_type: 'email',    confidence: 1.0, requires_manual: false },
    { label: 'Phone',           field_name: 'phoneNumber',    field_type: 'tel',      confidence: 1.0, requires_manual: false },
    { label: 'Resume / CV',     field_name: 'resume',         field_type: 'file',     confidence: 1.0, requires_manual: true  },
    { label: 'Cover Letter',    field_name: 'coverLetter',    field_type: 'textarea', confidence: 0.8, requires_manual: false },
    { label: 'LinkedIn URL',    field_name: 'web[LinkedIn]',  field_type: 'url',      confidence: 0.8, requires_manual: false },
  ],
  Workable: [
    { label: 'First Name',      field_name: 'firstname',      field_type: 'text',     confidence: 1.0, requires_manual: false },
    { label: 'Last Name',       field_name: 'lastname',       field_type: 'text',     confidence: 1.0, requires_manual: false },
    { label: 'Email',           field_name: 'email',          field_type: 'email',    confidence: 1.0, requires_manual: false },
    { label: 'Phone',           field_name: 'phone',          field_type: 'tel',      confidence: 0.9, requires_manual: false },
    { label: 'Resume / CV',     field_name: 'resume',         field_type: 'file',     confidence: 1.0, requires_manual: true  },
    { label: 'Cover Letter',    field_name: 'cover_letter',   field_type: 'textarea', confidence: 0.8, requires_manual: false },
    { label: 'LinkedIn Profile', field_name: 'linkedin',      field_type: 'url',      confidence: 0.8, requires_manual: false },
  ],
  Recruitee: [
    { label: 'Full Name',       field_name: 'name',           field_type: 'text',     confidence: 1.0, requires_manual: false },
    { label: 'Email',           field_name: 'email',          field_type: 'email',    confidence: 1.0, requires_manual: false },
    { label: 'Phone',           field_name: 'phone',          field_type: 'tel',      confidence: 0.9, requires_manual: false },
    { label: 'Resume / CV',     field_name: 'resume',         field_type: 'file',     confidence: 1.0, requires_manual: true  },
    { label: 'Cover Letter',    field_name: 'cover_letter',   field_type: 'textarea', confidence: 0.8, requires_manual: false },
    { label: 'LinkedIn URL',    field_name: 'linkedin',       field_type: 'url',      confidence: 0.8, requires_manual: false },
  ],
  LinkedIn: [
    { label: 'Phone',           field_name: 'phoneNumber',    field_type: 'tel',      confidence: 0.9, requires_manual: false },
    { label: 'Resume / CV',     field_name: 'resume',         field_type: 'file',     confidence: 1.0, requires_manual: true  },
    { label: 'Cover Letter',    field_name: 'coverLetter',    field_type: 'textarea', confidence: 0.7, requires_manual: false },
    { label: 'Years of Experience', field_name: 'yearsOfExperience', field_type: 'select', confidence: 0.9, requires_manual: false },
  ],
}

const GENERIC_FIELDS: Array<Omit<FormField, 'value'>> = [
  { label: 'First Name',  field_name: 'first_name',   field_type: 'text',     confidence: 0.8, requires_manual: false },
  { label: 'Last Name',   field_name: 'last_name',    field_type: 'text',     confidence: 0.8, requires_manual: false },
  { label: 'Email',       field_name: 'email',        field_type: 'email',    confidence: 0.9, requires_manual: false },
  { label: 'Phone',       field_name: 'phone',        field_type: 'tel',      confidence: 0.8, requires_manual: false },
  { label: 'Resume / CV', field_name: 'resume',       field_type: 'file',     confidence: 0.9, requires_manual: true  },
  { label: 'Cover Letter', field_name: 'cover_letter', field_type: 'textarea', confidence: 0.7, requires_manual: false },
  { label: 'LinkedIn URL', field_name: 'linkedin',    field_type: 'url',      confidence: 0.7, requires_manual: false },
]

// Candidate profile values — these populate the mapping
const PROFILE_VALUES: Record<string, string> = {
  first_name:         'Athar',
  last_name:          'Hafiz',
  name:               'Athar Hafiz',
  email:              'athar@atharux.com',
  phone:              '',
  linkedin_url:       'https://www.linkedin.com/in/atharhafiz',
  'urls[LinkedIn]':   'https://www.linkedin.com/in/atharhafiz',
  'web[LinkedIn]':    'https://www.linkedin.com/in/atharhafiz',
  linkedin:           'https://www.linkedin.com/in/atharhafiz',
  website:            'https://atharux.com',
  portfolio:          'https://atharux.com',
  'urls[Portfolio]':  'https://atharux.com',
  org:                'Atharux',
}

export async function mapForm(url: string, rawJd?: string): Promise<FormMapping> {
  const ats = detectATS(url)
  const baseFields = ATS_BASE_FIELDS[ats] ?? GENERIC_FIELDS

  // Ask LLM if there are likely custom questions based on the JD
  let extraFields: FormField[] = []
  if (rawJd && rawJd.length > 100) {
    try {
      const raw = await callAI({
        model: getPreferredFreeModel(),
        groqModel: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You detect custom application form questions from job descriptions.
Return a JSON array of likely custom fields. Each item: { "label": string, "field_name": string, "field_type": "textarea"|"text"|"select"|"checkbox", "value": string, "confidence": 0.0–1.0, "requires_manual": boolean }
Rules:
- Only add fields NOT already covered by standard ATS fields (name, email, phone, resume, cover letter, LinkedIn)
- Common extras: salary expectations, work authorisation, notice period, years of experience, specific tools/skills, "why this company", portfolio link, language proficiency
- value should be a realistic answer for a Berlin-based UX Engineer / AI consultant: notice period "2 weeks", work auth "EU citizen – no sponsorship needed", salary "open to discussion"
- requires_manual: true only if it needs a job-specific answer
- Return [] if no obvious custom questions
Return JSON array only, no prose.`,
          },
          {
            role: 'user',
            content: `ATS: ${ats}\nJob URL: ${url}\n\nJob Description (excerpt):\n${rawJd.slice(0, 1500)}`,
          },
        ],
        max_tokens: 600,
        temperature: 0.1,
      })

      const cleaned = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(cleaned) as FormField[]
      if (Array.isArray(parsed)) extraFields = parsed.slice(0, 6)
    } catch {
      // LLM parse failure — proceed with base fields only
    }
  }

  // Merge base fields with profile values
  const fields: FormField[] = baseFields.map(f => ({
    ...f,
    value: PROFILE_VALUES[f.field_name] ?? '',
  }))

  return { url, fields: [...fields, ...extraFields] }
}
