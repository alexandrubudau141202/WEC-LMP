import React, { useState } from 'react';
import { CLASS_LABELS, getCar } from '../cars';

// Named setup snapshots (car + setup + conditions), stored in localStorage.
// Independent of the auto-save toggle: these are explicit saves.
export default function SavedSetups({ setups, currentCarName, onSave, onLoad, onDelete }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [track, setTrack] = useState('');
  const [trackTemp, setTrackTemp] = useState('');
  const [airTemp, setAirTemp] = useState('');

  const handleSave = () => {
    const fallback = `${currentCarName} · ${new Date().toLocaleString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })}`;
    const setupData = {
      name: name.trim() || fallback,
      track: track.trim(),
      trackTemp: trackTemp.trim(),
      airTemp: airTemp.trim(),
      dateModified: new Date().toISOString(),
    };
    onSave(setupData);
    setName('');
    setTrack('');
    setTrackTemp('');
    setAirTemp('');
    setOpen(true);
  };

  return (
    <section className={`input-section collapsible ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="section-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <h2 className="section-title">
          <svg className="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          Saved Setups
          {setups.length > 0 && <span className="saved-count">{setups.length}</span>}
        </h2>
        <svg className="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="section-body">
          <div className="save-setup-form">
            <input
              type="text"
              className="save-setup-input"
              placeholder={`Setup name (${currentCarName})…`}
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <input
              type="text"
              className="save-setup-input"
              placeholder="Track — e.g. Monza…"
              value={track}
              onChange={(e) => setTrack(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <div className="save-setup-grid">
              <label className="save-setup-field">
                <span>Track °C</span>
                <input
                  type="number"
                  className="save-setup-input"
                  placeholder="35"
                  value={trackTemp}
                  onChange={(e) => setTrackTemp(e.target.value)}
                />
              </label>
              <label className="save-setup-field">
                <span>Air °C</span>
                <input
                  type="number"
                  className="save-setup-input"
                  placeholder="24"
                  value={airTemp}
                  onChange={(e) => setAirTemp(e.target.value)}
                />
              </label>
              <button type="button" className="save-setup-button" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>

          {setups.length === 0 ? (
            <p className="saved-empty">No saved setups yet — dial something in and save it.</p>
          ) : (
            <ul className="saved-list">
              {setups.map((entry) => {
                const entryCar = getCar(entry.carId);
                const savedDate = entry.dateModified ?? entry.savedAt;
                return (
                  <li key={entry.id} className="saved-item">
                    <div className="saved-item-top">
                      <span className="saved-item-name">{entry.name}</span>
                      <div className="saved-item-actions">
                        <button
                          type="button"
                          className="saved-load-button"
                          onClick={() => onLoad(entry)}
                          title="Load this setup"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          className="saved-delete-button"
                          onClick={() => onDelete(entry.id)}
                          title="Delete this setup"
                          aria-label={`Delete ${entry.name}`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <div className="saved-item-car">
                      {entryCar.name}
                      <span className={`class-badge class-${entryCar.carClass}`}>
                        {CLASS_LABELS[entryCar.carClass]}
                      </span>
                    </div>

                    <div className="saved-item-tags">
                      {entry.track && <span className="saved-tag">{entry.track}</span>}
                      {entry.trackTemp && <span className="saved-tag">Track {entry.trackTemp}°C</span>}
                      {entry.airTemp && <span className="saved-tag">Air {entry.airTemp}°C</span>}
                      {savedDate && (
                        <span className="saved-item-date">
                          {new Date(savedDate).toLocaleString([], {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}