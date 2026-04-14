import React from 'react';

export default function DiagnosisReport({ diagnosis }) {
  if (!diagnosis) {
    return (
      <div className="empty-state">
        <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>No diagnosis available yet. Configure setup and analyze.</p>
      </div>
    );
  }
  
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };
  
  const getConfidenceBadge = (confidence) => {
    const percent = Math.round(confidence * 100);
    let label, color;
    
    if (percent >= 80) {
      label = 'HIGH';
      color = '#10b981';
    } else if (percent >= 60) {
      label = 'MEDIUM';
      color = '#f59e0b';
    } else {
      label = 'LOW';
      color = '#ef4444';
    }
    
    return { label, color, percent };
  };
  
  const confidenceBadge = getConfidenceBadge(diagnosis.confidence);
  
  return (
    <div className="diagnosis-report">
      
      {/* Executive Summary */}
      <section className="report-section executive-summary">
        <h2 className="report-heading">Executive Summary</h2>
        <p className="summary-text">{diagnosis.executive_summary}</p>
      </section>
      
      {/* Primary Issue */}
      <section className="report-section">
        <h2 className="report-heading">Primary Issue</h2>
        <div className="issue-card">
          <div className="issue-header">
            <h3 className="issue-title">
              {diagnosis.primary_issue.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </h3>
            <div className="issue-badges">
              <span 
                className="severity-badge"
                style={{ backgroundColor: `${getSeverityColor(diagnosis.severity)}20`, color: getSeverityColor(diagnosis.severity) }}
              >
                {diagnosis.severity.toUpperCase()}
              </span>
              <span 
                className="confidence-badge"
                style={{ backgroundColor: `${confidenceBadge.color}20`, color: confidenceBadge.color }}
              >
                {confidenceBadge.label} ({confidenceBadge.percent}%)
              </span>
            </div>
          </div>
          
          {diagnosis.contributing_factors.length > 0 && (
            <div className="contributing-factors">
              <h4 className="factors-title">Contributing Factors:</h4>
              <ul className="factors-list">
                {diagnosis.contributing_factors.map((factor, index) => (
                  <li key={index}>{factor}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
      
      {/* Recommended Actions */}
      {diagnosis.recommendations.length > 0 && (
        <section className="report-section">
          <h2 className="report-heading">
            <svg className="heading-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Recommended Actions
          </h2>
          
          <div className="recommendations-list">
            {diagnosis.recommendations.map((rec, index) => (
              <div key={index} className="recommendation-card">
                <div className="rec-header">
                  <span className="rec-priority">{rec.priority}</span>
                  <h3 className="rec-title">
                    {rec.parameter.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </h3>
                  <span className="rec-change">{rec.change}</span>
                </div>
                
                <div className="rec-body">
                  <div className="rec-row">
                    <span className="rec-label">Rationale:</span>
                    <span className="rec-value">{rec.rationale}</span>
                  </div>
                  <div className="rec-row">
                    <span className="rec-label">Expected Impact:</span>
                    <span className="rec-value">{rec.expected_impact}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      
      {/* Setup Changes Preview */}
      {diagnosis.recommendations.length > 0 && (
        <section className="report-section">
          <h2 className="report-heading">Setup Changes</h2>
          <div className="changes-grid">
            {diagnosis.recommendations.slice(0, 3).map((rec, index) => (
              <div key={index} className="change-card">
                <div className="change-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="change-content">
                  <p className="change-param">
                    {rec.parameter.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                  <p className="change-value">{rec.change}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      
    </div>
  );
}