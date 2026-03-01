import React, { useState, useEffect } from 'react';
import { X, ArrowRight, CheckCircle, FileText, Wand2, Users, Target } from 'lucide-react';

export default function OnboardingTutorial({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const steps = [
    {
      icon: Target,
      title: 'Welcome to Forge!',
      description: 'Track your job applications, manage resumes, and level up your job search with AI-powered tools.',
      color: '#6ee7b7'
    },
    {
      icon: FileText,
      title: 'Track Applications',
      description: 'Add job applications, track their status (Applied → Interview → Offered), and never lose track of where you applied.',
      color: '#3b82f6'
    },
    {
      icon: FileText,
      title: 'Manage Resume Versions',
      description: 'Store multiple resume versions, edit them side-by-side, and keep track of which resume you sent to each company.',
      color: '#a855f7'
    },
    {
      icon: Wand2,
      title: 'AI Resume Assembly',
      description: 'Paste a job description and let AI customize your resume to match. Powered by Groq (free & fast) or Claude.',
      color: '#f59e0b'
    },
    {
      icon: Users,
      title: 'Gamification & Leaderboard',
      description: 'Earn points for applications, interviews, and offers. Compete with others and unlock achievements!',
      color: '#ec4899'
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    setIsVisible(false);
    setTimeout(() => {
      onComplete();
    }, 300);
  };

  if (!isVisible) return null;

  const step = steps[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="onboarding-overlay">
      <style>{`
        .onboarding-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .onboarding-modal {
          background: linear-gradient(135deg, rgba(15, 20, 25, 0.95), rgba(20, 25, 35, 0.95));
          border: 1px solid rgba(110, 231, 183, 0.2);
          border-radius: 24px;
          padding: 48px;
          max-width: 600px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 100px rgba(110, 231, 183, 0.1);
          animation: slideUp 0.4s ease;
          position: relative;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .onboarding-close {
          position: absolute;
          top: 20px;
          right: 20px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 8px;
          cursor: pointer;
          transition: all 0.2s;
          color: #94a3b8;
        }

        .onboarding-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #e2e8f0;
        }

        .onboarding-icon {
          width: 80px;
          height: 80px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 32px;
          background: linear-gradient(135deg, rgba(110, 231, 183, 0.1), rgba(59, 130, 246, 0.1));
          border: 2px solid rgba(110, 231, 183, 0.3);
        }

        .onboarding-title {
          font-size: 28px;
          font-weight: 700;
          color: #e2e8f0;
          text-align: center;
          margin-bottom: 16px;
          line-height: 1.3;
        }

        .onboarding-description {
          font-size: 16px;
          color: #94a3b8;
          text-align: center;
          line-height: 1.6;
          margin-bottom: 40px;
        }

        .onboarding-progress {
          display: flex;
          gap: 8px;
          justify-content: center;
          margin-bottom: 32px;
        }

        .onboarding-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          transition: all 0.3s;
        }

        .onboarding-dot.active {
          width: 24px;
          border-radius: 4px;
          background: linear-gradient(90deg, #6ee7b7, #3b82f6);
        }

        .onboarding-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .onboarding-btn {
          padding: 14px 32px;
          border-radius: 12px;
          border: none;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: inherit;
        }

        .onboarding-btn-primary {
          background: linear-gradient(135deg, #6ee7b7, #3b82f6);
          color: #0d1117;
        }

        .onboarding-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(110, 231, 183, 0.3);
        }

        .onboarding-btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          color: #94a3b8;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .onboarding-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #e2e8f0;
        }

        @media (max-width: 640px) {
          .onboarding-modal {
            padding: 32px 24px;
          }

          .onboarding-title {
            font-size: 24px;
          }

          .onboarding-description {
            font-size: 14px;
          }

          .onboarding-actions {
            flex-direction: column;
          }

          .onboarding-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>

      <div className="onboarding-modal">
        <button className="onboarding-close" onClick={handleSkip}>
          <X size={20} />
        </button>

        <div className="onboarding-icon" style={{ borderColor: step.color + '50' }}>
          <Icon size={40} style={{ color: step.color }} />
        </div>

        <h2 className="onboarding-title">{step.title}</h2>
        <p className="onboarding-description">{step.description}</p>

        <div className="onboarding-progress">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`onboarding-dot ${index === currentStep ? 'active' : ''}`}
            />
          ))}
        </div>

        <div className="onboarding-actions">
          {currentStep > 0 && (
            <button
              className="onboarding-btn onboarding-btn-secondary"
              onClick={() => setCurrentStep(currentStep - 1)}
            >
              Back
            </button>
          )}
          <button
            className="onboarding-btn onboarding-btn-primary"
            onClick={handleNext}
          >
            {isLastStep ? (
              <>
                <CheckCircle size={18} />
                Get Started
              </>
            ) : (
              <>
                Next
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
