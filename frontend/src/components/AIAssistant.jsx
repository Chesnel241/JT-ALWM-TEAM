import { useState, useRef, useEffect } from 'react';
import Joyride, { STATUS } from 'react-joyride';
import { MessageSquare, X, Send, Bot, User, HelpCircle } from 'lucide-react';
import { tourSteps } from '../data/tourSteps';
import { getAIResponse, suggestedQuestions } from '../data/faqKnowledge';

export default function AIAssistant({ currentPage }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', content: "Bonjour ! Je suis l'assistant IA. Posez-moi vos questions ou cliquez sur le bouton 'Guide Visuel' pour une visite guidée de cette page." }
  ]);
  const [inputValue, setInputValue] = useState('');
  
  // Joyride State
  const [runTour, setRunTour] = useState(false);
  const [steps, setSteps] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Scroll to bottom of chat when new message arrives
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    // Set steps based on current page context
    if (tourSteps[currentPage]) {
      setSteps(tourSteps[currentPage]);
    } else {
      setSteps([]); // No tour for this page
    }
  }, [currentPage]);

  const handleStartTour = () => {
    setIsChatOpen(false); // Close chat if open to show the tour better
    setRunTour(true);
  };

  const handleJoyrideCallback = (data) => {
    const { status } = data;
    const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];
    
    if (finishedStatuses.includes(status)) {
      setRunTour(false);
    }
  };

  const sendQuestion = (questionText) => {
    if (!questionText.trim()) return;

    const newMessages = [...messages, { role: 'user', content: questionText }];
    setMessages(newMessages);
    setInputValue('');

    // Simulate AI thinking delay
    setTimeout(() => {
      const response = getAIResponse(questionText);
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
      <Joyride
        steps={steps}
        run={runTour}
        continuous={true}
        showProgress={true}
        showSkipButton={true}
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: 'var(--accent)',
            zIndex: 10000,
          },
          tooltipContainer: {
            textAlign: 'left'
          }
        }}
        locale={{
          back: 'Précédent',
          close: 'Fermer',
          last: 'Terminer',
          next: 'Suivant',
          skip: 'Passer le guide'
        }}
      />

      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
        
        {/* Floating Bubble Prompt */}
        {!isChatOpen && !runTour && (
          <div 
            className="mb-3 bg-white text-[color:var(--ink)] px-4 py-2 rounded-2xl shadow-lg cursor-pointer border border-[var(--border)] animate-bounce font-medium text-sm"
            onClick={() => setIsChatOpen(true)}
          >
            Veux-tu savoir comment faire ? 👋
            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white border-b border-r border-[var(--border)] transform rotate-45"></div>
          </div>
        )}

        {/* The Chat Window */}
        {isChatOpen && (
          <div className="mb-4 w-80 sm:w-96 bg-[var(--paper)] rounded-2xl shadow-2xl border border-[var(--border)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
            {/* Header */}
            <div className="bg-[var(--accent)] p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold">
                <Bot size={20} />
                Assistant IA
              </div>
              <button 
                onClick={() => setIsChatOpen(false)}
                className="text-white/80 hover:text-white transition-colors"
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
            </div>

            {/* Visual Guide Trigger */}
            {steps.length > 0 && (
              <div className="p-2 bg-[var(--paper)] border-t border-[var(--border)]">
                <button 
                  onClick={handleStartTour}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[color:var(--accent)]/10 text-[color:var(--accent-deep)] hover:bg-[color:var(--accent)]/20 transition-colors font-medium text-sm border border-[color:var(--accent)]/20"
                >
                  <HelpCircle size={16} />
                  Lancer la visite guidée de cette page
                </button>
              </div>
            )}

            {/* Suggested Questions */}
            {messages.length === 1 && (
              <div className="px-4 pb-3 bg-[var(--paper)] flex flex-col gap-2">
                <p className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wider mb-1">Questions fréquentes</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendQuestion(q)}
                      className="text-xs text-left px-3 py-1.5 rounded-lg bg-[var(--paper-2)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors active:scale-95"
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
                placeholder="Posez votre question..." 
                className="flex-1 bg-[var(--paper-2)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
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
            className="w-14 h-14 bg-[var(--accent)] text-white rounded-full shadow-xl flex items-center justify-center hover:scale-105 transition-transform focus:outline-none focus:ring-4 focus:ring-[var(--accent)]/30"
          >
            <MessageSquare size={24} />
          </button>
        )}
      </div>
    </>
  );
}
