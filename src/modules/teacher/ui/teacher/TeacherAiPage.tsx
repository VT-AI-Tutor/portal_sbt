import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/ui/tabs";
import { Bot, Sparkles, Languages } from "lucide-react";
import mascot from "@/core/assets/mascot-bee.png";
import { AssistantPanel } from "@/modules/teacher/ui/shared/ai/AssistantPanel";
import { QuestionBankPanel } from "@/modules/teacher/ui/shared/ai/QuestionBankPanel";
import { TranslatePanel } from "@/modules/teacher/ui/shared/ai/TranslatePanel";

export function TeacherAiPage() {
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
        <div className="flex items-center gap-4">
          <img
            src={mascot}
            alt="Ong Chăm Chỉ"
            className="size-16 animate-float"
          />
          <div>
            <div className="flex items-center gap-2 text-fun mb-1">
              <Sparkles className="size-4" />
              <span className="text-xs uppercase font-bold">Trợ lí AI</span>
            </div>
            <h1 className="font-display text-3xl font-bold">🐝 Ong Chăm Chỉ</h1>
            <p className="text-muted-foreground">
              Trợ lí AI riêng của cô — hỏi đáp, sinh câu hỏi, dịch song ngữ.
            </p>
          </div>
        </div>

        <Tabs defaultValue="assistant" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="assistant" className="py-2.5 gap-2">
              <Bot className="size-4" />{" "}
              <span className="hidden sm:inline">Trợ lý AI</span>
            </TabsTrigger>
            <TabsTrigger value="questions" className="py-2.5 gap-2">
              <Sparkles className="size-4" />{" "}
              <span className="hidden sm:inline">AI tạo câu hỏi</span>
            </TabsTrigger>
            <TabsTrigger value="translate" className="py-2.5 gap-2">
              <Languages className="size-4" />{" "}
              <span className="hidden sm:inline">Dịch song ngữ</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="assistant" className="mt-4">
            <AssistantPanel />
          </TabsContent>
          <TabsContent value="questions" className="mt-4">
            <QuestionBankPanel />
          </TabsContent>
          <TabsContent value="translate" className="mt-4">
            <TranslatePanel />
          </TabsContent>
        </Tabs>
      </div>
  );
}
