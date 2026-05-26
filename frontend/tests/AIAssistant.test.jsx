import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AIAssistant from '../src/components/AIAssistant';
import { getTourSteps } from '../src/data/tourSteps';
import { I18nProvider } from '../src/i18n/I18nContext';
import { translations } from '../src/i18n/translations';
import React from 'react';

// Mock react-joyride to prevent issues during jsdom rendering
vi.mock('react-joyride', () => {
  return {
    Joyride: () => <div data-testid="joyride-mock" />,
    STATUS: { FINISHED: 'finished', SKIPPED: 'skipped' },
    default: () => <div data-testid="joyride-mock" />
  };
});

// Polyfill for scrollIntoView which is not implemented in jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('getTourSteps', () => {
  it('returns the correct objects', () => {
    const t = translations.fr;
    const steps = getTourSteps(t);
    
    expect(steps).toHaveProperty('home');
    expect(steps).toHaveProperty('uploader');
    expect(steps).toHaveProperty('dashboard');
    expect(steps).toHaveProperty('delivery');
    expect(steps).toHaveProperty('voixoff');
    
    expect(Array.isArray(steps.home)).toBe(true);
    expect(steps.home.length).toBeGreaterThan(0);
    expect(steps.home[0]).toHaveProperty('target');
    expect(steps.home[0]).toHaveProperty('content');
  });
});

describe('AIAssistant UI component', () => {
  const renderComponent = () => {
    return render(
      <I18nProvider>
        <AIAssistant currentPage="home" />
      </I18nProvider>
    );
  };

  it('renders the floating button initially', () => {
    renderComponent();
    const t = translations.en;
    // The greeting text should be visible
    const greetingBtn = screen.getByText(t.aiAssistant.greeting);
    expect(greetingBtn).toBeInTheDocument();
  });

  it('opens the chat window when floating button is clicked', () => {
    renderComponent();
    const t = translations.en;
    
    const promptBtn = screen.getByText(t.aiAssistant.greeting);
    fireEvent.click(promptBtn);
    
    // The chat window should display the bot name
    const botName = screen.getByText(t.aiAssistant.botName);
    expect(botName).toBeInTheDocument();
    
    // The chat history should contain the chatGreeting
    const chatGreeting = screen.getByText(t.aiAssistant.chatGreeting);
    expect(chatGreeting).toBeInTheDocument();
    
    // The start tour button should be visible
    const startTourBtn = screen.getByText(t.aiAssistant.startTour);
    expect(startTourBtn).toBeInTheDocument();
  });
});
