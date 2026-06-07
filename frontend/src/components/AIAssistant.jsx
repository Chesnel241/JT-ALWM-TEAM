import { useState, useRef, useEffect } from 'react';
import { Joyride, STATUS } from 'react-joyride';
import { useI18n } from '../i18n/I18nContext';
import { MessageSquare, X, Send, Bot, User, HelpCircle } from 'lucide-react';
import { getTourSteps } from '../data/tourSteps';
import { getAIResponse, getSuggestedQuestions } from '../data/faqKnowledge';

// Clé localStorage : si l'utilisateur ferme la bulle "Veux-tu savoir comment
// faire ?", on la cache pour 24 h (évite que la bulle masque les boutons
// d'action sur mobile à chaque visite).
const BUBBLE_HIDDEN_KEY = 'jt-ai-bubble-hidden-until';

export default function AIAssistant({ currentPage }) {
  const { t, lang } = useI18n();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [bubbleHidden, setBubbleHidden] = useState(() => {
    const until = parseInt(localStorage.getItem(BUBBLE_HIDDEN_KEY) || '0', 10);
    return until > Date.now();
  });
  const [messages, setMessages] = useState([
    { role: 'ai', content: t.aiAssistant.chatGreeting }
  ]);
  const [inputValue, setInputValue] = useState('');
  
  const [runTour, setRunTour] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [steps, setSteps] = useState([]);
  const allTourSteps = getTourSteps(t);
  const messagesEndRef = useRef(null);

  // Démarre le tour en ne gardant que les étapes dont la cible existe
  // réellement dans le DOM. Sur mobile, les boutons nav (#tour-nav-*)
  // sont derrière le menu hamburger → absents → react-joyride hang.
  // On filtre pour éviter le blocage.
  const startTour = () => {
    const pageSteps = allTourSteps[currentPage] || [];
    const visible = pageSteps.filter(
      (s) => s.target === 'body' || document.querySelector(s.target)
    );
    if (visible.length === 0) return;
    setSteps(visible);
    setIsChatOpen(false);
    setStepIndex(0);
    setRunTour(true);
  };

  const hasTour = (allTourSteps[currentPage] || []).length > 0;

  useEffect(() => {
    // Scroll to bottom of chat when new message arrives
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleJoyrideCallback = (data) => {
    const { status } = data;
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
      <div className="fixed bottom-24 sm:bottom-6 right-4 sm:right-6 z-[9999] flex flex-col items-end">
        
        {/* Floating Bubble Prompt */}
        {!isChatOpen && !runTour && !bubbleHidden && (
          <div className="flex items-center gap-1 bg-[var(--paper)] text-[color:var(--ink)] pl-4 pr-1 py-1 rounded-full shadow-lg border border-[var(--border)] mb-4 animate-bounce">
            <button
              onClick={() => setIsChatOpen(true)}
              className="text-sm font-medium py-1"
            >
              {t.aiAssistant.greeting}
            </button>
            <button
              onClick={() => {
                localStorage.setItem(BUBBLE_HIDDEN_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
                setBubbleHidden(true);
              }}
              aria-label="Masquer la bulle"
              className="ml-1 w-7 h-7 flex items-center justify-center rounded-full text-[color:var(--muted)] hover:bg-[var(--paper-2)] hover:text-[color:var(--ink)]"
              title="Masquer (24 h)"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* The Chat Window */}
        {isChatOpen && (
          <div className="mb-4 w-[calc(100vw-2rem)] max-w-sm sm:w-96 bg-[var(--paper)] rounded-2xl shadow-2xl border border-[var(--border)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
            {/* Header */}
            <div className="p-4 border-b border-[var(--border)] bg-[var(--paper-2)] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 text-[color:var(--ink)] font-semibold">
                <Bot className="w-5 h-5" />
                {t.aiAssistant.botName}
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                aria-label={t.aiAssistant.joyride.close}
                className="text-[color:var(--muted)] hover:text-[color:var(--ink)] transition-colors p-2 -mr-2 rounded-lg"
              >
                <X size={22} />
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
              {hasTour && (
                <div className="p-3 bg-[var(--paper-2)] rounded-lg text-center mx-4 mt-2 shrink-0">
                  <button
                    onClick={startTour}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-[var(--ink)] text-[color:var(--paper)] rounded-lg font-medium hover:opacity-90 transition-opacity"
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
                aria-label={t.aiAssistant.joyride.next}
                className="bg-[var(--accent)] text-white p-3 rounded-xl disabled:opacity-50 transition-opacity shrink-0"
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
