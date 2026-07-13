import { useState } from 'react';
import { Building2, X } from 'lucide-react';
import { findAndAddCompany } from '../agents/scout';
import { getCustomCompanies, removeCustomCompany } from '../agents/companyRegistry';

// Find a funded startup's ATS board by name/domain, verify it live, and add it
// to the registry Scout scans. Never stores an unverified slug.
export default function CompanyFinder() {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState(null); // { type, msg }
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState(() => getCustomCompanies());

  const find = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setLoading(true);
    setStatus(null);
    try {
      const match = await findAndAddCompany(q);
      if (match) {
        setStatus({ type: 'ok', msg: `Found on ${match.provider}: "${match.slug}" — ${match.jobCount} live jobs. Added to Scout.` });
        setCompanies(getCustomCompanies());
        setInput('');
      } else {
        setStatus({ type: 'warn', msg: `No ATS board found for "${q}". Try the company's careers-page domain (e.g. jobs.acme.com).` });
      }
    } catch {
      setStatus({ type: 'warn', msg: 'Lookup failed — check your connection and try again.' });
    } finally {
      setLoading(false);
    }
  };

  const remove = (c) => {
    removeCustomCompany(c.provider, c.slug);
    setCompanies(getCustomCompanies());
  };

  return (
    <div className="api-settings-section" style={{ borderTop: '1px solid #1e1e2e', paddingTop: '1rem' }}>
      <div className="api-settings-label">
        <span>
          <Building2 size={14} style={{ color: '#06b6d4', verticalAlign: 'middle', marginRight: '6px' }} aria-hidden="true" />
          Find funded startups to scan
        </span>
      </div>
      <div className="api-settings-hint" style={{ marginBottom: '10px' }}>
        Enter a company name or careers domain. It probes ATS boards (Greenhouse, Ashby, Lever,
        SmartRecruiters, Recruitee) and adds it to Scout only if a live board is found.
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          className="api-settings-input"
          placeholder="e.g. Taktile  or  jobs.taktile.com"
          value={input}
          onChange={(e) => { setInput(e.target.value); setStatus(null); }}
          onKeyDown={(e) => e.key === 'Enter' && find()}
        />
        <button
          className="api-settings-btn api-settings-btn-primary"
          onClick={find}
          disabled={loading || !input.trim()}
          style={{ whiteSpace: 'nowrap' }}
        >
          {loading ? 'Finding…' : 'Find + Add'}
        </button>
      </div>

      {status && (
        <div className="api-settings-hint" style={{ marginTop: '6px', color: status.type === 'ok' ? '#22c55e' : '#f59e0b' }}>
          {status.msg}
        </div>
      )}

      {companies.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div className="api-settings-hint" style={{ marginBottom: '6px' }}>Added companies ({companies.length}):</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {companies.map((c) => (
              <div key={`${c.provider}:${c.slug}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)', borderRadius: '4px', padding: '6px 10px' }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '11px', color: '#94a3b8' }}>
                  {c.name} <span style={{ color: '#475569' }}>· {c.provider}/{c.slug}</span>
                </span>
                <button
                  onClick={() => remove(c)}
                  aria-label={`Remove ${c.name}`}
                  style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 0, display: 'flex' }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
