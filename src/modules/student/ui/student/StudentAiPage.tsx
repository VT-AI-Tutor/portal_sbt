import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/ui/tabs";
import { Sparkles, PenLine, MessageCircleQuestion } from "lucide-react";
import { CozzyAvatar } from "@/modules/student/ui/student/CozzyAvatar";
import { useGamificationSummary } from "@/modules/student/api/hooks";
import { FlashcardsPanel } from "@/modules/student/ui/shared/ai/FlashcardsPanel";
import { EssayCoachPanel } from "@/modules/student/ui/shared/ai/EssayCoachPanel";
import { HomeworkTutorPanel } from "@/modules/student/ui/shared/ai/HomeworkTutorPanel";

export function StudentAiPage() {
  const { data: summary } = useGamificationSummary();
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-5">
      <div className="flex items-center gap-4">
        <CozzyAvatar equipped={summary?.equipped} className="size-16 animate-float" />
        <div>
          <div className="flex items-center gap-2 text-fun mb-1">
            <Sparkles className="size-4" />
            <span className="text-xs uppercase font-bold">Trợ lí AI</span>
          </div>
          <h1 className="font-display text-3xl font-bold">🐲 Rồng Cozzy</h1>
          <p className="text-muted-foreground">
            Bạn AI của em — hỏi bài, học từ vựng bằng flashcard và nhờ Cô AI
            chấm văn nhé!
          </p>
        </div>
      </div>

      <Tabs defaultValue="homework" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="homework" className="py-2.5 gap-2">
            <MessageCircleQuestion className="size-4" />{" "}
            <span className="hidden sm:inline">Hỏi bài</span>
          </TabsTrigger>
          <TabsTrigger value="flashcards" className="py-2.5 gap-2">
            <Sparkles className="size-4" />{" "}
            <span className="hidden sm:inline">Flashcard AI</span>
          </TabsTrigger>
          <TabsTrigger value="essay" className="py-2.5 gap-2">
            <PenLine className="size-4" />{" "}
            <span className="hidden sm:inline">Cô AI chấm văn</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="homework" className="mt-4">
          <HomeworkTutorPanel />
        </TabsContent>
        <TabsContent value="flashcards" className="mt-4">
          <FlashcardsPanel />
        </TabsContent>
        <TabsContent value="essay" className="mt-4">
          <EssayCoachPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
