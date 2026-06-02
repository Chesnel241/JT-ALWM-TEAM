import { describe, it, expect, vi } from 'vitest';
import { setProgress, finishJob, getJobState, addListener } from '../src/services/editorProgress.js';

// Faux objet res SSE pour capturer ce qui est poussé au client.
function fakeRes() {
  return {
    written: [],
    ended: false,
    write(s) { this.written.push(s); },
    end() { this.ended = true; },
  };
}

describe('editorProgress recoverable jobs', () => {
  it('garde le résultat (url) interrogeable après finishJob', () => {
    const id = `job-${Math.random()}`;
    setProgress(id, 50, 'encoding');
    finishJob(id, 'done', 'https://local.example/export.mp4');

    const state = getJobState(id);
    expect(state).toEqual({ percent: 100, status: 'done', url: 'https://local.example/export.mp4' });
  });

  it('pousse immédiatement l\'état final à un listener qui se (re)connecte après la fin', () => {
    const id = `job-${Math.random()}`;
    finishJob(id, 'done', 'https://local.example/late.mp4');

    const res = fakeRes();
    addListener(id, res); // reconnexion SSE après coupure pendant le rendu

    expect(res.ended).toBe(true);
    const payload = JSON.parse(res.written.at(-1).replace(/^data: /, '').trim());
    expect(payload).toMatchObject({ status: 'done', url: 'https://local.example/late.mp4', percent: 100 });
  });

  it('ne régresse pas un job déjà terminé', () => {
    const id = `job-${Math.random()}`;
    finishJob(id, 'done', 'https://local.example/final.mp4');
    setProgress(id, 10, 'encoding'); // event tardif ignoré
    expect(getJobState(id).status).toBe('done');
    expect(getJobState(id).percent).toBe(100);
  });

  it('retourne null pour un job inconnu', () => {
    expect(getJobState('nope')).toBeNull();
  });
});
