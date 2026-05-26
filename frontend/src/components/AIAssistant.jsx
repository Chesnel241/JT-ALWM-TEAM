import { useState, useRef, useEffect } from 'react';
import { Joyride, STATUS } from 'react-joyride';
import { useI18n } from '../i18n/I18nContext';
import { MessageSquare, X, Send, Bot, User, HelpCircle } from 'lucide-react';
import { getTourSteps } from '../data/tourSteps';
import { getAIResponse, getSuggestedQuestions } from '../data/faqKnowledge';

export default function AIAssistant({ currentPage }) {
  const { t, lang } = useI18n();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', content: t.aiAssistant.chatGreeting }
  ]);
  const [inputValue, setInputValue] = useState('');
  
  const [runTour, setRunTour] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const allTourSteps = getTourSteps(t);
  const steps = allTourSteps[currentPage] || [];
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Scroll to bottom of chat when new message arrives
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleJoyrideCallback = (data) => {
    const { status, type, index, action } = data;
    console.error(`JOYRIDE CALLBACK: type=${type}, status=${status}, action=${action}, index=${index}`);
    const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];
    
    // Handle tour finish
    if (finishedStatuses.includes(status)) {
      setRunTour(false);
      setStepIndex(0);
    }
  };

  const sendQuestion = (questionText) => {
    if (!questionText.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: questionText }]);
    setInputValue('');

    // Simulate AI thinking delay
    setTimeout(() => {
      const response = getAIResponse(questionText, t, lang);
      setMessages(prev => [...prev, { role: 'ai', content: response }]);
    }, 600);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    sendQuestion(inputValue);
  };

  return (
    <>
      {/* react-joyride Tour Component */}
      {Joyride && runTour && (
        <Joyride
          steps={steps}
          run={runTour}
          continuous={true}
          showProgress={true}
          showSkipButton={true}
          callback={handleJoyrideCallback}
          disableScrolling={true}
          styles={{
            options: {
              primaryColor: 'var(--ink)',
              zIndex: 10000,
            }
          }}
          locale={{
            back: t.aiAssistant.joyride.back,
            close: t.aiAssistant.joyride.close,
            last: t.aiAssistant.joyride.last,
            next: t.aiAssistant.joyride.next,
            skip: t.aiAssistant.joyride.skip
          }}
        />
      )}

      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
        
        {/* Floating Bubble Prompt */}
        {!isChatOpen && !runTour && (
          <button 
            onClick={() => setIsChatOpen(true)}
            className="flex items-center gap-2 bg-[var(--paper)] text-[color:var(--ink)] px-4 py-2 rounded-full shadow-lg border border-[var(--border)] hover:bg-[var(--paper-2)] transition-colors mb-4 animate-bounce"
          >
            <span className="text-sm font-medium">{t.aiAssistant.greeting}</span>
          </button>
        )}

        {/* The Chat Window */}
        {isChatOpen && (
          <div className="mb-4 w-80 sm:w-96 bg-[var(--paper)] rounded-2xl shadow-2xl border border-[var(--border)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
            {/* Header */}
            <div className="p-4 border-b border-[var(--border)] bg-[var(--paper-2)] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 text-[color:var(--ink)] font-semibold">
                <Bot className="w-5 h-5" />
                {t.aiAssistant.botName}
              </div>
              <button 
                onClick={() => setIsChatOpen(false)}
                className="text-[color:var(--muted)] hover:text-[color:var(--ink)] transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Chat History */}
            <div className="flex-1 p-4 overflow-y-auto max-h-80 min-h-[300px] flex flex-col gap-3 bg-[var(--paper-2)]">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-[var(--ink)] text-[var(--paper)]' : 'bg-[var(--accent)] text-white'}`}>
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={`px-4 py-2 rounded-2xl max-w-[80%] text-sm ${msg.role === 'user' ? 'bg-[var(--ink)] text-[var(--paper)] rounded-tr-none' : 'bg-[var(--paper)] text-[var(--ink)] border border-[var(--border)] rounded-tl-none shadow-sm'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
              
              {/* Visual Guide Trigger */}
              {steps.length > 0 && (
                <div className="p-3 bg-[var(--paper-2)] rounded-lg text-center mx-4 mt-2 shrink-0">
                  <button 
                    onClick={() => {
                      setIsChatOpen(false);
                      setStepIndex(0);
                      setRunTour(true);
                    }}
                    className="flex items-center justify-center gap-2 w-full py-2 bg-[var(--ink)] text-[color:var(--paper)] rounded-lg font-medium hover:opacity-90 transition-opacity"
                  >
                    <HelpCircle className="w-4 h-4" />
                    {t.aiAssistant.startTour}
                  </button>
                </div>
              )}
            </div>

            {/* Suggested Questions */}
            {messages.length === 1 && (
              <div className="p-4 border-t border-[var(--border)] shrink-0">
                <p className="text-xs text-[color:var(--muted)] mb-2 font-medium uppercase tracking-wider">{t.aiAssistant.suggestedTitle}</p>
                <div className="flex flex-wrap gap-2">
                  {getSuggestedQuestions(t).map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendQuestion(q)}
                      className="text-xs bg-[var(--paper-2)] border border-[var(--border)] text-[color:var(--ink)] px-3 py-1.5 rounded-full hover:border-[var(--ink)] transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-3 bg-[var(--paper)] border-t border-[var(--border)] flex gap-2">
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={t.aiAssistant.inputPlaceholder}
                className="flex-1 bg-transparent border-none outline-none text-sm text-[color:var(--ink)] placeholder-[color:var(--muted)]"
              />
              <button 
                type="submit" 
                disabled={!inputValue.trim()}
                className="bg-[var(--accent)] text-white p-2 rounded-xl disabled:opacity-50 transition-opacity"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        )}

        {/* Floating Main Button */}
        {!isChatOpen && (
          <button 
            onClick={() => setIsChatOpen(true)}
            className="w-14 h-14 bg-[var(--ink)] text-[color:var(--paper)] rounded-full shadow-xl flex items-center justify-center hover:scale-105 transition-transform focus:outline-none focus:ring-4 focus:ring-[var(--ink)]/30"
          >
            <MessageSquare size={24} />
          </button>
        )}
      </div>
    </>
  );
}
