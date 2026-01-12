import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchApi } from "../../utils/fetch_api";
import Markdown from "react-markdown";
import { useDateStore } from "../../store/date-store";
import type { IChatBotQuestion, IGenerateResponse } from "../../types/chatbot.types";
import { useUserPreferencesStore } from "../../store/user-preferences-store";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { HiOutlineDotsVertical } from "react-icons/hi";
import { X, Send } from "lucide-react";
import "./chat_bot.css";
import { QuickActionsSection } from "./quick_actions_section";
import { cn } from "../../lib/utils";
import { useGetQuestions } from "../../lib/query/chatbot/get_questions";
import { useGetChatbotReport } from "../../lib/query/chatbot/get_report";

interface Message {
  content: string;
  role: "user" | "assistant";
  isTyping?: boolean;
  isThinking?: boolean;
}

interface ChatBotProps {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  playerId: number;
  category: "injury" | "performance";
  initialQuestion?: string | null;
  setInitialQuestion: Dispatch<SetStateAction<string | null>>;
}

const ChatbotButton = ({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) => {
  return (
    <div
      className={cn("flex items-center justify-center", !isOpen && "fixed bottom-8 right-8 z-50")}
    >
      <button
        type="button"
        className="bg-blue-600 hover:bg-blue-500 p-6 rounded-full aspect-square w-20 hover:scale-105 transition-all duration-200 shadow-lg flex items-center justify-center"
        onClick={onClick}
      >
        <img src="/icons/mauna.svg" alt="Mauna logo" />
      </button>
    </div>
  );
};

interface InputFieldSectionProps {
  message: string;
  setMessage: (value: string) => void;
  onSendMessage: (message: string) => void;
  isWaitingForResponse: boolean;
}

const InputFieldSection = ({
  message,
  setMessage,
  onSendMessage,
  isWaitingForResponse,
}: InputFieldSectionProps) => {
  const { t } = useTranslation("chatbot");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (message.trim() && !isWaitingForResponse) {
          onSendMessage(message);
          setMessage("");
        }
      }}
      className="relative"
    >
      <div className="group bg-white/5 border border-white/10 rounded-2xl h-12 pl-4 pr-3 py-2 flex items-center gap-4 hover:border-white/20 focus-within:!border-[#007BFF] transition-colors duration-200">
        <input
          type="text"
          className="flex-1 bg-transparent rounded-lg text-white placeholder-white/50 focus:outline-none focus-visible:outline-none"
          placeholder={t("inputPlaceholder")}
          onChange={(e) => setMessage(e.target.value)}
          value={message}
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          disabled={!message.trim() || isWaitingForResponse}
          className={cn(
            "opacity-60 hover:opacity-100 group-focus-within:opacity-100 disabled:opacity-30 transition-opacity duration-100 flex-shrink-0 group/button",
            "[&_svg]:!size-6",
            isWaitingForResponse && "disabled:cursor-not-allowed",
          )}
        >
          <Send size={24} className="text-white group-disabled/button:opacity-30" />
        </Button>
      </div>
    </form>
  );
};

export const ChatBot = ({
  isOpen,
  setIsOpen,
  playerId,
  category,
  initialQuestion,
  setInitialQuestion,
}: ChatBotProps) => {
  const { t } = useTranslation("chatbot");
  const { t: tCommon } = useTranslation("common");

  const [message, setMessage] = useState("");
  const { athleteDate } = useDateStore();
  const [discussionId, setDiscussionId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<IChatBotQuestion[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const previousDateRef = useRef<string | null>(null);

  const { chatWidth, setChatWidth } = useUserPreferencesStore();
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLButtonElement>(null);

  const { data: defaultQuestions = [] } = useGetQuestions(category);
  const { data: reportData, isLoading: reportLoading } = useGetChatbotReport(
    playerId,
    athleteDate,
    category,
  );

  const defaultMessage = useMemo(
    () => [
      {
        content: t("defaultMessage"),
        role: "assistant" as const,
      },
    ],
    [t],
  );

  useEffect(() => {
    if (athleteDate !== previousDateRef.current) {
      previousDateRef.current = athleteDate;
      setMessages([]);
      setQuestions([]);
      setDiscussionId(null);
      setInitialQuestion(null);
    }
  }, [athleteDate]);

  useEffect(() => {
    if (isOpen && !reportLoading && messages.length === 0) {
      if (reportData?.report?.reportMessage) {
        setMessages([
          {
            content: reportData.report.reportMessage,
            role: "assistant",
          },
        ]);
      } else {
        setMessages(defaultMessage);
      }
    }
  }, [isOpen, reportData, reportLoading, messages.length, defaultMessage]);

  const handleClearHistory = () => {
    setMessages(defaultMessage);
    setQuestions([]);
    setDiscussionId(null);
    setInitialQuestion(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || isMobile) return;

      const newWidth = window.innerWidth - e.clientX;
      const maxWidth = window.innerWidth * 0.8;
      const constrainedWidth = Math.max(440, Math.min(maxWidth, newWidth));
      setChatWidth(constrainedWidth);
    },
    [isResizing, setChatWidth, isMobile],
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [isMobile, setIsOpen]);

  const handleSendMessage = useCallback(
    async (message: string) => {
      setMessages((prev) => [...prev, { content: message, role: "user" }]);
      setMessages((prev) => [...prev, { content: "", role: "assistant", isThinking: true }]);

      try {
        const response = await fetchApi<IGenerateResponse>("/chatbots/generate-response", {
          method: "POST",
          body: JSON.stringify({
            prompt: message,
            athleteId: playerId,
            date: athleteDate,
            discussionId,
            category,
          }),
        });

        setInitialQuestion(null);

        if (response.discussionId) {
          setDiscussionId(response.discussionId);
          // loadDiscussions();
        }

        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.isThinking) {
            lastMessage.content = response.response;
            lastMessage.isThinking = false;
            lastMessage.isTyping = true;
            setQuestions(response.questions);
          }
          return newMessages;
        });
      } catch (error) {
        console.error("Error fetching chatbot response:", error);
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.isThinking) {
            lastMessage.content = "Sorry, I encountered an error. Please try again.";
            lastMessage.isThinking = false;
            lastMessage.isTyping = true;
            setQuestions([]);
          }
          return newMessages;
        });
      }
    },
    [playerId, athleteDate, discussionId, category, setInitialQuestion],
  );

  const isWaitingForResponse = useMemo(
    () => messages.some((msg) => msg.isThinking || msg.isTyping),
    [messages],
  );

  useEffect(() => {
    if (isOpen && initialQuestion) {
      if (!isWaitingForResponse) {
        handleSendMessage(initialQuestion);
      }

      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [isOpen, initialQuestion, handleSendMessage, scrollToBottom, isWaitingForResponse]);

  const shouldShowDefaultQuestions =
    isOpen && messages.length === 1 && questions.length === 0 && !isWaitingForResponse;

  return (
    <>
      {!isOpen && (
        <ChatbotButton
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => {
              scrollToBottom();
            }, 100);
          }}
          isOpen={isOpen}
        />
      )}

      {isOpen && (
        <div
          className={cn(
            "fixed top-0 right-0 z-50 flex chatbot-dialog h-full",
            isMobile ? "w-full" : "",
          )}
          style={!isMobile ? { width: `${chatWidth}px` } : undefined}
        >
          <button
            type="button"
            ref={resizeRef}
            className={cn(
              "cursor-col-resize transition-all duration-200 flex items-center justify-center chatbot-resize-handle self-stretch pl-2 pr-0",
              isMobile && "hidden",
            )}
            onMouseDown={handleMouseDown}
          />

          <div
            className={cn("flex-1 bg-[#1E2638] flex flex-col", chatWidth <= 440 && "shadow-2xl")}
          >
            <div className="flex items-center justify-between p-3 pl-6 border-b border-white/10">
              <h2 className="text-base font-normal">
                <span className="text-white/60">Mauna AI / </span>
                <span className="text-white">
                  {category === "performance"
                    ? tCommon("tabs.performance")
                    : tCommon("tabs.injury")}
                </span>
              </h2>

              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="group hover:bg-white/10"
                    >
                      <HiOutlineDotsVertical
                        size={20}
                        className="text-white opacity-60 group-hover:opacity-100 transition-opacity duration-200"
                      />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 bg-[#252d3b] border-[#3a4454] p-0" align="end">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleClearHistory}
                      className="w-full justify-start px-4 py-3 text-white hover:bg-white/5"
                    >
                      {t("clearHistory")}
                    </Button>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="group hover:bg-white/10"
                >
                  <X
                    size={20}
                    className="text-white opacity-60 group-hover:opacity-100 transition-opacity duration-200"
                  />
                </Button>
              </div>
            </div>

            <div className="bg-[#1E2638] flex-1 overflow-y-auto p-5 space-y-4 chatbot-messages">
              {messages.map((message, index) => (
                <Message
                  key={`${message.content}-${index}`}
                  message={message}
                  setMessages={setMessages}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="bg-[#1e2638] border-t border-white/10 flex flex-col gap-5 pt-4 pb-5 px-6">
              {!isWaitingForResponse && (
                <QuickActionsSection
                  questions={shouldShowDefaultQuestions ? defaultQuestions : questions}
                  onQuestionClick={(question) => {
                    handleSendMessage(question);
                    setQuestions([]);
                  }}
                />
              )}

              <InputFieldSection
                message={message}
                setMessage={setMessage}
                onSendMessage={handleSendMessage}
                isWaitingForResponse={isWaitingForResponse}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const TypingMessage = ({
  content,
  setMessages,
}: {
  content: string;
  setMessages: Dispatch<SetStateAction<Message[]>>;
}) => {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < content.length) {
      const timer = setTimeout(() => {
        setDisplayedText((prev) => prev + content[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, 10);

      return () => clearTimeout(timer);
    }

    setMessages((prev) => {
      const newMessages = [...prev];
      const lastMessage = newMessages[newMessages.length - 1];
      if (lastMessage?.isTyping) {
        lastMessage.isTyping = false;
      }
      return newMessages;
    });
  }, [currentIndex, content, setMessages]);

  return (
    <div className="inline-flex max-w-full w-auto px-6 py-4 flex-col items-start gap-4 rounded-[24px_24px_24px_4px] chatbot-message-base markdown-content bg-gradient-to-br from-[#2C3649] to-[#262F40]">
      <Markdown>{displayedText}</Markdown>
    </div>
  );
};

const ThinkingDots = () => {
  const { t } = useTranslation("chatbot");
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/70 text-sm">{t("thinking")}</span>
      <div className="flex gap-1">
        <div className="w-1 h-1 bg-white/70 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <div className="w-1 h-1 bg-white/70 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <div className="w-1 h-1 bg-white/70 rounded-full animate-bounce" />
      </div>
    </div>
  );
};

const Message = ({
  message,
  setMessages,
}: {
  message: Message;
  setMessages: Dispatch<SetStateAction<Message[]>>;
}) => {
  if (message.role === "assistant") {
    return (
      <div className="flex items-start gap-3">
        <div>
          {message.isThinking ? (
            <ThinkingDots />
          ) : message.isTyping ? (
            <TypingMessage content={message.content} setMessages={setMessages} />
          ) : (
            <div className="inline-flex max-w-full w-auto px-6 py-4 flex-col items-start gap-4 rounded-[24px_24px_24px_4px] chatbot-message-base markdown-content bg-gradient-to-br from-[#2C3649] to-[#262F40]">
              <Markdown>{message.content}</Markdown>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 justify-end">
      <div className="flex justify-end">
        <div className="inline-flex max-w-[calc(100%-40px)] w-auto ml-10 px-6 py-4 flex-col items-start gap-4 rounded-[24px_24px_4px_24px] chatbot-message-base break-words bg-gradient-to-br from-[#2C455C] to-[#274056]">
          {message.content}
        </div>
      </div>
    </div>
  );
};
