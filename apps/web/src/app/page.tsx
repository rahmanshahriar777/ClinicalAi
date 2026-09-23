'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { homeFor, useAuth } from '@/lib/auth';
import { ClinicBridgeLogo } from '@/components/clinicbridge-logo';

interface RoleDemo {
  role: string;
  title: string;
  email: string;
  description: string;
  badge: string;
  features: string[];
}

const DEMO_ACCOUNTS: RoleDemo[] = [
  {
    role: 'CLINICIAN',
    title: 'Dr. Sarah Smith',
    email: 'dr.smith@demo-clinic.test',
    badge: 'Physician / GP',
    description: 'Direct clinical encounters, AI SOAP note generation, queue review, and document signoff.',
    features: ['Real-time SOAP drafting', 'Encounter progress notes', 'AI review & approval queue', 'Prescription & diagnosis codes'],
  },
  {
    role: 'PATIENT',
    title: 'Peter Patient',
    email: 'patient@demo-clinic.test',
    badge: 'Patient Portal',
    description: 'Digital intake questionnaire, signed visit summaries, appointment schedule, and secure messaging.',
    features: ['Smart intake screening', 'Medical consent controls', 'Signed document vault', 'Direct care team chat'],
  },
  {
    role: 'NURSE',
    title: 'Nina Nurse',
    email: 'nurse@demo-clinic.test',
    badge: 'Care Team Lead',
    description: 'Intake reviews, initial message triage, symptom escalation handling, and patient support drafts.',
    features: ['Digital intake approvals', 'Urgency queue triage', 'Care-team dispatch', 'Red-flag alerts'],
  },
  {
    role: 'ADMIN',
    title: 'Ada Admin',
    email: 'admin@demo-clinic.test',
    badge: 'System Admin',
    description: 'Multi-tenant organization AI policy, provider routing (Azure, Bedrock, Ollama), and feature flags.',
    features: ['AI Provider Gateway router', 'Prompt template registry', 'Hard-gate redaction rules', 'Staff credential provisioning'],
  },
  {
    role: 'COMPLIANCE',
    title: 'Cora Compliance',
    email: 'compliance@demo-clinic.test',
    badge: 'Governance Officer',
    description: 'Read-only access to immutable audit trails, cryptographic document revisions, and patient consents.',
    features: ['Zero-PHI tamper logs', 'SHA-256 signature chains', 'Consent withdrawal tracker', 'AI inference telemetry'],
  },
  {
    role: 'FRONT_DESK',
    title: 'Frank Desk',
    email: 'frontdesk@demo-clinic.test',
    badge: 'Reception & Operations',
    description: 'Patient check-in, walk-in appointment booking, scheduling, and arrival verification.',
    features: ['Daily appointment board', 'Fast check-in flow', 'No-show marking', 'Patient registration'],
  },
];

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Patient Intake & Instant Screening',
    tagline: 'Deterministic safety before any AI model invocation',
    description:
      'Patients complete their medical history and symptom questionnaire online. Every intake runs through deterministic keyword rules. Red-flag symptoms like chest pain or acute stroke immediately trigger automated emergency guidance and page the care team before any LLM is contacted.',
    badges: ['Synchronous Rule Engine', 'Instant Emergency Text', 'Zero-Latency Gate'],
  },
  {
    step: '02',
    title: 'AI Clinical Drafting & Extraction',
    tagline: 'Structured SOAP documentation generated in seconds',
    description:
      'During or after the consultation, clinicians record encounter shorthand or dictations. The ClinicBridge AI Gateway redacts all PHI, injects strict safety boundaries, and requests standardized SOAP notes with clinical assessment, treatment plan, and ICD-10 diagnostic suggestions.',
    badges: ['Automatic PHI Masking', 'Strict Zod Contracts', 'Isolated Draft Sandbox'],
  },
  {
    step: '03',
    title: 'Human-in-the-Loop Review Queue',
    tagline: 'Nothing reaches the record without licensed physician approval',
    description:
      'Every AI-generated document and message response is held in a dedicated Review Queue with draft status PENDING_REVIEW. Clinicians review side-by-side with original consultation inputs, make inline adjustments, or reject drafts. Content hashes are computed and frozen upon approval.',
    badges: ['Zero-Unapproved Path', 'Side-by-Side Diffing', 'Cryptographic Signoff'],
  },
  {
    step: '04',
    title: 'Secure Delivery & Patient Communication',
    tagline: 'Safe, verified communication delivered seamlessly',
    description:
      'Approved visit summaries, patient education sheets, and message responses are signed and dispatched to the patient portal and mobile app with end-to-end encryption. All interactions are permanently preserved in the immutable audit ledger.',
    badges: ['Signed Documents', 'Device Push Delivery', 'Immutable Audit Record'],
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeWorkflow, setActiveWorkflow] = useState(0);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const handleCopy = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2500);
  };

  const handleQuickLogin = (email: string) => {
    router.push(`/login?email=${encodeURIComponent(email)}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white">
      {/* Top Banner for Logged-In Users */}
      {user ? (
        <aside aria-label="Active session banner" className="sticky top-0 z-50 flex items-center justify-between border-b border-blue-200 bg-blue-50/95 px-6 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-3 text-sm text-blue-900">
            <span className="flex h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse" />
            <span>
              Signed in as <strong>{user.firstName} {user.lastName}</strong> ({user.role.toLowerCase().replace('_', ' ')})
            </span>
          </div>
          <Link
            href={homeFor(user.role)}
            className="rounded-md bg-blue-600 px-4 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Go to Your Workspace &rarr;
          </Link>
        </aside>
      ) : null}

      {/* Main Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <ClinicBridgeLogo variant="full" size="md" href="/" priority />

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#workflow" className="transition hover:text-blue-600">Clinical Workflow</a>
            <a href="#safety" className="transition hover:text-blue-600">Safety & Governance</a>
            <a href="#roles" className="transition hover:text-blue-600">Role Portals</a>
            <a href="#demo" className="transition hover:text-blue-600">Test Personas</a>
            <a href="http://localhost:4000/docs" target="_blank" rel="noreferrer" className="flex items-center gap-1 transition hover:text-blue-600">
              <span>API Docs</span>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/25 transition hover:bg-blue-700"
            >
              Patient Portal
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/60 via-slate-50 to-white" />
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Left Content */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-blue-700 shadow-sm mb-6">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                <span>v1.0 Production Blueprint Architecture</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-600">Zero-Unapproved Safety Gate</span>
              </div>

              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Clinical Documentation &amp;{' '}
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Patient Communication
                </span>{' '}
                Engine
              </h1>

              <p className="mt-6 text-lg leading-relaxed text-slate-600 max-w-2xl">
                ClinicBridge accelerates ambulatory care with automated SOAP note drafting, intelligent message triage, and digital intake summaries — while guaranteeing licensed human approval before any output reaches a patient or medical record.
              </p>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href="#demo"
                  className="rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-700 hover:shadow-blue-500/40"
                >
                  Explore Demo Personas
                </a>
                <Link
                  href="/login"
                  className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                >
                  Clinician Sign In &rarr;
                </Link>
                <a
                  href="#workflow"
                  className="text-sm font-medium text-slate-600 hover:text-blue-600 transition flex items-center gap-1.5 px-3 py-2"
                >
                  <span>See How It Works</span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </a>
              </div>

              {/* Trust Badges */}
              <div className="mt-10 border-t border-slate-200/80 pt-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Built to rigorous clinical governance standards
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-6 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Deterministic Red-Flag Rules</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>HIPAA Compliant &amp; BAA Ready</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Cryptographic Signatures (SHA-256)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Interactive Mockup / UI Snapshot */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xl shadow-slate-300/40 transition hover:shadow-slate-300/60">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <ClinicBridgeLogo variant="mark" size="xs" />
                    <span className="text-xs font-semibold text-slate-800">Clinician Workspace · Encounter #ENC-2026-08</span>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                    PENDING APPROVAL
                  </span>
                </div>

                {/* SOAP Note Mockup Preview */}
                <div className="mt-4 space-y-3 font-sans text-xs">
                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-blue-900 uppercase tracking-wide text-[10px]">Subjective (AI Drafted)</span>
                      <span className="text-[10px] text-slate-600">Model: Azure GPT-4o</span>
                    </div>
                    <p className="mt-1 text-slate-700 leading-relaxed">
                      42-year-old male presents with 3-day history of productive cough, mild fatigue, and fever (38.2°C). Denies shortness of breath, chest pain, or hemoptysis.
                    </p>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                    <span className="font-semibold text-blue-900 uppercase tracking-wide text-[10px]">Objective</span>
                    <p className="mt-1 text-slate-700 leading-relaxed">
                      BP 124/82, HR 78, RR 16, SpO2 98% on room air. Chest examination reveals bilateral vesicular breathing, slight expiratory wheeze in right lower zone.
                    </p>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                    <span className="font-semibold text-blue-900 uppercase tracking-wide text-[10px]">Assessment &amp; Diagnostic Plan</span>
                    <p className="mt-1 text-slate-700 leading-relaxed">
                      1. Acute Bronchitis (J20.9).<br />
                      2. Recommended: Supportive care, oral hydration, paracetamol as needed. Sputum culture if symptoms persist &gt;7 days.
                    </p>
                  </div>

                  {/* Safety Check Bar */}
                  <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800 border border-emerald-200">
                    <div className="flex items-center gap-1.5">
                      <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span className="text-[11px] font-semibold">Red-Flag Scan: 0 Critical Alerts · Redaction Verified</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-700">HASH: 4b29…f8a1</span>
                  </div>

                  {/* Mock Action Bar */}
                  <div className="pt-2 flex items-center justify-end gap-2">
                    <span className="text-[10px] text-slate-600 mr-auto">Logged as Dr. Sarah Smith</span>
                    <button type="button" className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      Edit Draft
                    </button>
                    <button type="button" className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700">
                      Approve &amp; Sign
                    </button>
                  </div>
                </div>
              </div>

              {/* Floating Stat Widget */}
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="text-xl font-bold text-blue-600">81/81</div>
                  <div className="text-[11px] font-medium text-slate-600">Automated Tests</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="text-xl font-bold text-emerald-600">0%</div>
                  <div className="text-[11px] font-medium text-slate-600">Unapproved Leaks</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="text-xl font-bold text-indigo-600">&lt;2 sec</div>
                  <div className="text-[11px] font-medium text-slate-600">Avg Note Draft Time</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Safety & Core Pillars */}
      <section id="safety" className="border-y border-slate-200 bg-white py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700 border border-blue-200">
              The Safety Foundation
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Engineered with Policy That Can Only Tighten
            </h2>
            <p className="mt-3 text-base text-slate-600">
              ClinicBridge eliminates the risks of medical LLMs by enforcing deterministic boundaries and cryptographic provenance on every data flow.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 shadow-sm transition hover:bg-white hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 text-red-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">Deterministic Red-Flags</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Critical symptom patterns (chest pain, stroke, breathing distress) run synchronously on message submission. Emergency guidance text is returned to the patient before calling any LLM.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 shadow-sm transition hover:bg-white hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">Zero-Unapproved Gate</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                There is no code path in the platform where raw AI text reaches a patient or the medical record without an explicit, authenticated <code className="bg-slate-200 px-1 rounded text-xs">Approval</code> row signed by authorized clinical staff.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 shadow-sm transition hover:bg-white hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">PHI Redaction &amp; Router</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                The AI Gateway scrubs names, phones, and MRNs via dual-layer Presidio &amp; regex rule engine before payload transmission. External AI can be globally toggled or restricted per organization.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 shadow-sm transition hover:bg-white hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">Immutable Audit Trail</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Every document mutation, consent change, AI generation prompt hash, and clinical approval is timestamped and recorded in an append-only audit ledger accessible to Compliance Officers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Clinical Workflow Walkthrough */}
      <section id="workflow" className="py-16 lg:py-24 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700 border border-blue-200">
              Valid Process Architecture
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              From Patient Intake to Signed Chart Note
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Explore the four-stage clinical pipeline designed according to blueprint §4.2, §4.3, and §4.4 specifications.
            </p>
          </div>

          {/* Workflow Tabs */}
          <div className="mt-12 grid grid-cols-2 gap-2 rounded-xl bg-slate-200/70 p-1.5 sm:grid-cols-4 max-w-4xl mx-auto">
            {WORKFLOW_STEPS.map((w, idx) => (
              <button
                key={w.step}
                type="button"
                onClick={() => setActiveWorkflow(idx)}
                className={`rounded-lg py-2.5 px-3 text-xs sm:text-sm font-semibold transition ${
                  activeWorkflow === idx
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                }`}
              >
                <span className="mr-1.5 opacity-60">{w.step}.</span>
                <span>{w.title.split('&')[0]?.trim()}</span>
              </button>
            ))}
          </div>

          {/* Active Workflow Display */}
          <div className="mt-8 max-w-4xl mx-auto rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-mono font-bold text-blue-600 uppercase">Phase {WORKFLOW_STEPS[activeWorkflow]?.step}</span>
                <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{WORKFLOW_STEPS[activeWorkflow]?.title}</h3>
                <p className="text-sm font-medium text-blue-700 mt-1">{WORKFLOW_STEPS[activeWorkflow]?.tagline}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {WORKFLOW_STEPS[activeWorkflow]?.badges.map((b) => (
                  <span key={b} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
                    {b}
                  </span>
                ))}
              </div>
            </div>

            <p className="mt-6 text-base leading-relaxed text-slate-700">
              {WORKFLOW_STEPS[activeWorkflow]?.description}
            </p>

            <div className="mt-6 rounded-xl bg-blue-50/60 p-4 border border-blue-100 flex items-center justify-between">
              <span className="text-xs text-blue-900 font-medium">
                Verify this step live in the clinician or patient workspace
              </span>
              <Link
                href="/login"
                className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
              >
                Launch Flow in App &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Role Portals Showcase */}
      <section id="roles" className="border-t border-slate-200 bg-white py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700 border border-blue-200">
              Multidisciplinary System
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Dedicated Workspaces for Every Healthcare Role
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Strict row-level security and permission matrices prevent data bleeding across patients, clinicians, and administrative teams.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {DEMO_ACCOUNTS.map((account) => (
              <div
                key={account.role}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-100">
                      {account.role}
                    </span>
                    <span className="text-xs text-slate-600 font-medium">{account.badge}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">{account.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{account.description}</p>

                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
                    {account.features.map((feat) => (
                      <div key={feat} className="flex items-center gap-2 text-xs text-slate-700">
                        <svg className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleCopy(account.email)}
                    className="text-xs font-mono text-slate-600 hover:text-blue-600 flex items-center gap-1"
                  >
                    <span>{account.email.split('@')[0]}@…</span>
                    <span className="text-[10px] text-blue-600 font-sans font-semibold">
                      {copiedEmail === account.email ? '✓ Copied' : 'Copy'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin(account.email)}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-600 transition"
                  >
                    Sign In &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Sandbox & Instant Testing */}
      <section id="demo" className="py-16 lg:py-24 bg-gradient-to-b from-slate-50 to-blue-50/50 border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-6">
          <div className="rounded-3xl border border-blue-200 bg-white p-8 md:p-12 shadow-xl shadow-blue-500/5">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-7">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 uppercase tracking-wide">
                  Live Test Sandbox
                </span>
                <h2 className="mt-4 text-3xl font-extrabold text-slate-900 sm:text-4xl">
                  Try the Complete 5-Minute Clinical Loop
                </h2>
                <p className="mt-3 text-base text-slate-600 leading-relaxed">
                  The local environment is pre-seeded with verified test data. Follow this path to test end-to-end clinical safety and AI drafting:
                </p>

                <ol className="mt-6 space-y-3 text-sm text-slate-700">
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">1</span>
                    <span>Sign in as <strong className="text-slate-900">patient@demo-clinic.test</strong> and submit a test message like <em>&ldquo;I have crushing chest pain&rdquo;</em> to see instant emergency escalation.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">2</span>
                    <span>Sign in as <strong className="text-slate-900">dr.smith@demo-clinic.test</strong> to view the Escalations board and Patient Inbox.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">3</span>
                    <span>Open the seeded appointment, start the encounter, click <em>&ldquo;Generate SOAP draft&rdquo;</em>, review in the AI Queue, and approve with signature.</span>
                  </li>
                </ol>

                <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-xs font-mono text-slate-700">
                  <span>Universal Sandbox Password:</span>
                  <code className="font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-slate-200">ClinicalAi!2026dev</code>
                </div>
              </div>

              <div className="lg:col-span-5 flex flex-col items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 p-8 text-white shadow-lg text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md mb-4 text-white">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold">Ready to Explore?</h3>
                <p className="mt-2 text-sm text-blue-100">
                  Launch the clinician workspace directly or view the interactive Swagger REST API.
                </p>
                <div className="mt-6 flex flex-col w-full gap-3">
                  <Link
                    href="/login"
                    className="w-full rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-md transition hover:bg-blue-50"
                  >
                    Open Application Login
                  </Link>
                  <a
                    href="http://localhost:4000/docs"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20 backdrop-blur-sm"
                  >
                    Browse REST Swagger &rarr;
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Emergency Disclaimer Banner */}
      <div className="bg-amber-500/10 border-y border-amber-200 px-6 py-4 text-center text-xs text-amber-900">
        <p className="max-w-4xl mx-auto font-medium">
          <strong>Medical Notice:</strong> ClinicBridge is an assistive clinical documentation and triage support platform for licensed healthcare providers. If you or someone you know is experiencing a life-threatening medical emergency, call 999 (UK), 911 (US), or your local emergency services immediately.
        </p>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 text-sm">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-wrap items-center justify-between gap-6 border-b border-slate-800 pb-8">
            <div className="flex items-center gap-3">
              <ClinicBridgeLogo variant="mark" size="sm" className="rounded-lg bg-white/10 p-1" />
              <div>
                <span className="text-lg font-bold text-white">ClinicBridge</span>
                <span className="ml-2 text-xs text-slate-500 font-mono">v1.0</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400">
              <a href="http://localhost:4000/docs" target="_blank" rel="noreferrer" className="hover:text-white transition">Swagger API</a>
              <a href="https://github.com/rahmanshahriar777/ClinicalAi.git" target="_blank" rel="noreferrer" className="hover:text-white transition">GitHub Repository</a>
              <Link href="/login" className="hover:text-white transition">Staff Sign In</Link>
              <Link href="/register" className="hover:text-white transition">Patient Registration</Link>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
            <p>&copy; {new Date().getFullYear()} ClinicBridge · Clinical Documentation and Patient Communication Engine. All rights reserved.</p>
            <p>Strict Human-in-the-Loop Protocol · Zero-Unapproved Content Path</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
