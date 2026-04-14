import React, { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:8000';

export default function TelemetryAnalysis() {
  const [file, setFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState(null);
  
  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      analyzeTelemetry(uploadedFile);
    }
  };
  
  const analyzeTelemetry = async (telemetryFile) => {
    setIsAnalyzing(true);
    
    try {
      // Parse CSV file
      const text = await telemetryFile.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',');
      
      const data = lines.slice(1).map(line => {
        const values = line.split(',');
        return headers.reduce((obj, header, index) => {
          obj[header.trim()] = parseFloat(values[index]) || values[index];
          return obj;
        }, {});
      }).filter(row => row[headers[0]]); // Remove empty rows
      
      // Generate analysis
      const analysis = generateTelemetryReport(data, telemetryFile.name);
      setReport(analysis);
      
    } catch (error) {
      console.error('Telemetry analysis failed:', error);
      alert('Failed to analyze telemetry. Make sure it\'s a valid CSV file.');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const generateTelemetryReport = (data, filename) => {
    // Extract circuit name from filename
    const circuit = filename.replace('.csv', '').replace('_telemetry', '');
    
    // Calculate key metrics
    const laps = [...new Set(data.map(d => d.Lap))].filter(Boolean);
    const bestLap = data.reduce((best, current) => {
      return (current.LapTime && (!best || current.LapTime < best.LapTime)) ? current : best;
    }, null);
    
    const avgSpeed = data.reduce((sum, d) => sum + (parseFloat(d.Speed) || 0), 0) / data.length;
    const maxSpeed = Math.max(...data.map(d => parseFloat(d.Speed) || 0));
    
    const avgThrottle = data.reduce((sum, d) => sum + (parseFloat(d.Throttle) || 0), 0) / data.length;
    const avgBrake = data.reduce((sum, d) => sum + (parseFloat(d.Brake) || 0), 0) / data.length;
    
    // Tire analysis
    const avgTireTemp = {
      fl: data.reduce((sum, d) => sum + (parseFloat(d.TireTemp_FL) || 0), 0) / data.length,
      fr: data.reduce((sum, d) => sum + (parseFloat(d.TireTemp_FR) || 0), 0) / data.length,
      rl: data.reduce((sum, d) => sum + (parseFloat(d.TireTemp_RL) || 0), 0) / data.length,
      rr: data.reduce((sum, d) => sum + (parseFloat(d.TireTemp_RR) || 0), 0) / data.length
    };
    
    // Identify issues
    const issues = [];
    
    if (avgTireTemp.fl - avgTireTemp.rl > 15) {
      issues.push({
        type: 'Tire Temperature Imbalance',
        severity: 'medium',
        description: 'Front left tire running significantly hotter than rear left',
        recommendation: 'Reduce front-left tire pressure by 0.1 bar or increase front wing angle'
      });
    }
    
    if (avgThrottle < 60) {
      issues.push({
        type: 'Low Throttle Application',
        severity: 'low',
        description: 'Average throttle application is below optimal',
        recommendation: 'Driver may be too conservative on exits - review hybrid deployment timing'
      });
    }
    
    if (maxSpeed < 280 && circuit.toLowerCase().includes('le_mans')) {
      issues.push({
        type: 'Low Top Speed',
        severity: 'high',
        description: 'Top speed significantly below Le Mans targets',
        recommendation: 'Reduce rear wing angle by 1-2° for Mulsanne straight'
      });
    }
    
    return {
      circuit,
      filename,
      summary: {
        totalLaps: laps.length,
        bestLapTime: bestLap?.LapTime || 'N/A',
        avgSpeed: avgSpeed.toFixed(1),
        maxSpeed: maxSpeed.toFixed(1),
        dataPoints: data.length
      },
      driverInputs: {
        avgThrottle: avgThrottle.toFixed(1),
        avgBrake: avgBrake.toFixed(1),
        throttleEfficiency: ((avgThrottle / 100) * 100).toFixed(1)
      },
      tireData: {
        avgTemps: {
          fl: avgTireTemp.fl.toFixed(1),
          fr: avgTireTemp.fr.toFixed(1),
          rl: avgTireTemp.rl.toFixed(1),
          rr: avgTireTemp.rr.toFixed(1)
        },
        balance: calculateTireBalance(avgTireTemp)
      },
      issues,
      timestamp: new Date().toLocaleString()
    };
  };
  
  const calculateTireBalance = (temps) => {
    const frontAvg = (temps.fl + temps.fr) / 2;
    const rearAvg = (temps.rl + temps.rr) / 2;
    const diff = frontAvg - rearAvg;
    
    if (Math.abs(diff) < 5) return 'Balanced';
    if (diff > 5) return 'Front-biased';
    return 'Rear-biased';
  };
  
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };
  
  return (
    <div className="telemetry-analysis">
      
      {/* Upload Section */}
      <section className="report-section">
        <h2 className="report-heading">
          <svg className="heading-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Upload Telemetry Data
        </h2>
        
        <div className="upload-zone">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="file-input"
            id="telemetry-upload"
          />
          <label htmlFor="telemetry-upload" className="upload-label">
            {file ? (
              <>
                <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="file-name">{file.name}</span>
                <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
              </>
            ) : (
              <>
                <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span>Drop telemetry CSV here or click to browse</span>
                <span className="upload-hint">Supports Le Mans, Spa, Monza, COTA circuits</span>
              </>
            )}
          </label>
        </div>
        
        {isAnalyzing && (
          <div className="analyzing-status">
            <svg className="spinner" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Analyzing telemetry data...
          </div>
        )}
      </section>
      
      {/* Report Display */}
      {report && (
        <>
          <section className="report-section">
            <h2 className="report-heading">Session Summary - {report.circuit}</h2>
            <div className="telemetry-grid">
              <div className="metric-card">
                <span className="metric-label">Total Laps</span>
                <span className="metric-value">{report.summary.totalLaps}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Best Lap</span>
                <span className="metric-value">{report.summary.bestLapTime}s</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Avg Speed</span>
                <span className="metric-value">{report.summary.avgSpeed} km/h</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Max Speed</span>
                <span className="metric-value">{report.summary.maxSpeed} km/h</span>
              </div>
            </div>
          </section>
          
          <section className="report-section">
            <h2 className="report-heading">Driver Inputs</h2>
            <div className="telemetry-grid">
              <div className="metric-card">
                <span className="metric-label">Avg Throttle</span>
                <span className="metric-value">{report.driverInputs.avgThrottle}%</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Avg Brake</span>
                <span className="metric-value">{report.driverInputs.avgBrake}%</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Efficiency</span>
                <span className="metric-value">{report.driverInputs.throttleEfficiency}%</span>
              </div>
            </div>
          </section>
          
          <section className="report-section">
            <h2 className="report-heading">Tire Analysis</h2>
            <div className="tire-report-grid">
              <div className="tire-metric">
                <span>FL: {report.tireData.avgTemps.fl}°C</span>
              </div>
              <div className="tire-metric">
                <span>FR: {report.tireData.avgTemps.fr}°C</span>
              </div>
              <div className="tire-metric">
                <span>RL: {report.tireData.avgTemps.rl}°C</span>
              </div>
              <div className="tire-metric">
                <span>RR: {report.tireData.avgTemps.rr}°C</span>
              </div>
            </div>
            <p className="balance-indicator">Balance: <strong>{report.tireData.balance}</strong></p>
          </section>
          
          {report.issues.length > 0 && (
            <section className="report-section">
              <h2 className="report-heading">Identified Issues</h2>
              <div className="issues-list">
                {report.issues.map((issue, index) => (
                  <div key={index} className="issue-card" style={{ borderLeftColor: getSeverityColor(issue.severity) }}>
                    <div className="issue-header">
                      <h3>{issue.type}</h3>
                      <span className="severity-badge" style={{ 
                        backgroundColor: `${getSeverityColor(issue.severity)}20`, 
                        color: getSeverityColor(issue.severity) 
                      }}>
                        {issue.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="issue-description">{issue.description}</p>
                    <p className="issue-recommendation">
                      <strong>Recommendation:</strong> {issue.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
      
    </div>
  );
}