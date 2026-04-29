import { Link, Navigate, useParams } from "react-router-dom";
import {
  BookOpen,
  BookType,
  ChevronLeft,
  ChevronRight,
  Hash,
  Layers,
  Lightbulb,
  ListTree,
  MessageSquareQuote,
  PenLine,
  Sparkles,
  TextQuote,
  Timer,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { arabicGrammarTopics, getGrammarTopic, type GrammarAccent, type GrammarTopic } from "@/data/arabicGrammarReference";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const topicIcons: Record<string, LucideIcon> = {
  "aqsam-al-kalam": Layers,
  ism: BookType,
  fil: PenLine,
  maazi: Timer,
  mudari: Waypoints,
  amr: MessageSquareQuote,
  harf: Hash,
  zameer: TextQuote,
  irab: ListTree,
  "mabni-murab": BookOpen,
  "raf-nasb-jar": Sparkles,
  extras: Lightbulb,
};

const accentStyles: Record<
  GrammarAccent,
  { card: string; banner: string; ring: string; badge: string; exampleBg: string }
> = {
  emerald: {
    card: "border-emerald-500/20 bg-gradient-to-br from-emerald-950/25 via-background to-background",
    banner: "from-emerald-600/30 via-emerald-500/10 to-transparent",
    ring: "ring-emerald-500/20",
    badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
    exampleBg: "bg-emerald-950/20 border-emerald-500/15",
  },
  teal: {
    card: "border-teal-500/20 bg-gradient-to-br from-teal-950/25 via-background to-background",
    banner: "from-teal-600/30 via-teal-500/10 to-transparent",
    ring: "ring-teal-500/20",
    badge: "border-teal-500/25 bg-teal-500/10 text-teal-900 dark:text-teal-100",
    exampleBg: "bg-teal-950/20 border-teal-500/15",
  },
  cyan: {
    card: "border-cyan-500/20 bg-gradient-to-br from-cyan-950/25 via-background to-background",
    banner: "from-cyan-600/30 via-cyan-500/10 to-transparent",
    ring: "ring-cyan-500/20",
    badge: "border-cyan-500/25 bg-cyan-500/10 text-cyan-900 dark:text-cyan-100",
    exampleBg: "bg-cyan-950/20 border-cyan-500/15",
  },
  sky: {
    card: "border-sky-500/20 bg-gradient-to-br from-sky-950/25 via-background to-background",
    banner: "from-sky-600/30 via-sky-500/10 to-transparent",
    ring: "ring-sky-500/20",
    badge: "border-sky-500/25 bg-sky-500/10 text-sky-900 dark:text-sky-100",
    exampleBg: "bg-sky-950/20 border-sky-500/15",
  },
  amber: {
    card: "border-amber-500/20 bg-gradient-to-br from-amber-950/30 via-background to-background",
    banner: "from-amber-600/35 via-amber-500/10 to-transparent",
    ring: "ring-amber-500/20",
    badge: "border-amber-500/25 bg-amber-500/10 text-amber-950 dark:text-amber-100",
    exampleBg: "bg-amber-950/25 border-amber-500/15",
  },
  orange: {
    card: "border-orange-500/20 bg-gradient-to-br from-orange-950/25 via-background to-background",
    banner: "from-orange-600/30 via-orange-500/10 to-transparent",
    ring: "ring-orange-500/20",
    badge: "border-orange-500/25 bg-orange-500/10 text-orange-900 dark:text-orange-100",
    exampleBg: "bg-orange-950/20 border-orange-500/15",
  },
  violet: {
    card: "border-violet-500/20 bg-gradient-to-br from-violet-950/25 via-background to-background",
    banner: "from-violet-600/30 via-violet-500/10 to-transparent",
    ring: "ring-violet-500/20",
    badge: "border-violet-500/25 bg-violet-500/10 text-violet-900 dark:text-violet-100",
    exampleBg: "bg-violet-950/20 border-violet-500/15",
  },
  rose: {
    card: "border-rose-500/20 bg-gradient-to-br from-rose-950/25 via-background to-background",
    banner: "from-rose-600/30 via-rose-500/10 to-transparent",
    ring: "ring-rose-500/20",
    badge: "border-rose-500/25 bg-rose-500/10 text-rose-900 dark:text-rose-100",
    exampleBg: "bg-rose-950/20 border-rose-500/15",
  },
  slate: {
    card: "border-slate-500/20 bg-gradient-to-br from-slate-900/40 via-background to-background",
    banner: "from-slate-600/30 via-slate-500/10 to-transparent",
    ring: "ring-slate-500/20",
    badge: "border-slate-500/25 bg-slate-500/10 text-slate-900 dark:text-slate-100",
    exampleBg: "bg-slate-900/25 border-slate-500/15",
  },
  lime: {
    card: "border-lime-500/20 bg-gradient-to-br from-lime-950/25 via-background to-background",
    banner: "from-lime-600/30 via-lime-500/10 to-transparent",
    ring: "ring-lime-500/20",
    badge: "border-lime-500/25 bg-lime-500/10 text-lime-950 dark:text-lime-100",
    exampleBg: "bg-lime-950/20 border-lime-500/15",
  },
  fuchsia: {
    card: "border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-950/25 via-background to-background",
    banner: "from-fuchsia-600/30 via-fuchsia-500/10 to-transparent",
    ring: "ring-fuchsia-500/20",
    badge: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-900 dark:text-fuchsia-100",
    exampleBg: "bg-fuchsia-950/20 border-fuchsia-500/15",
  },
};

function renderBoldSegments(s: string) {
  const parts = s.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, idx) =>
    idx % 2 === 1 ? (
      <strong key={idx} className="text-foreground font-semibold">
        {part}
      </strong>
    ) : (
      <span key={idx}>{part}</span>
    ),
  );
}

function TopicHome() {
  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-8">
      <section
        className="relative overflow-hidden rounded-2xl border bg-card px-6 py-10 sm:px-10 text-center shadow-sm"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 120% 80% at 50% -20%, hsl(160 45% 32% / 0.18), transparent 55%), radial-gradient(ellipse 80% 50% at 100% 50%, hsl(42 70% 45% / 0.08), transparent)",
        }}
      >
        <Badge variant="outline" className="mb-4 border-primary/30 bg-primary/5 text-primary">
          Self-paced · Text reference
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Arabic Grammar</h1>
        <p className="mt-2 text-lg font-['Amiri',serif] text-primary" dir="rtl">
          النَّحْوُ — فَهْمٌ وَاضِحٌ قُرْبَكَ
        </p>
        <p className="mt-4 max-w-2xl mx-auto text-muted-foreground text-sm sm:text-base leading-relaxed">
          Choose a topic card below. Each lesson opens on this same page with <strong>explanations</strong>, <strong>Arabic examples</strong>, and a{" "}
          <strong>key takeaway</strong> so you rarely need to search elsewhere while you study.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
          Pick a topic
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {arabicGrammarTopics.map((topic) => {
            const Icon = topicIcons[topic.id] ?? BookOpen;
            const a = accentStyles[topic.accent];
            return (
              <Link key={topic.id} to={`/arabic-grammar/${topic.id}`} className="group block h-full">
                <Card
                  className={cn(
                    "h-full transition-all duration-200 border-2 shadow-sm hover:shadow-md hover:-translate-y-0.5",
                    a.card,
                    "ring-0 hover:ring-2",
                    a.ring,
                  )}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-xl border text-foreground/90",
                          a.badge,
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 transition group-hover:opacity-100 group-hover:translate-x-0.5 shrink-0" />
                    </div>
                    <CardTitle className="text-base leading-snug pt-2 group-hover:text-primary transition-colors">
                      {topic.titleEn}
                    </CardTitle>
                    <CardDescription className="font-['Amiri',serif] text-base text-primary/90" dir="rtl">
                      {topic.titleAr}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground leading-relaxed">{topic.cardSummary}</p>
                    <p className="mt-3 text-xs font-medium text-primary">Open lesson →</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function TopicLesson({ topic }: { topic: GrammarTopic }) {
  const idx = arabicGrammarTopics.findIndex((t) => t.id === topic.id);
  const prev = idx > 0 ? arabicGrammarTopics[idx - 1] : null;
  const next = idx >= 0 && idx < arabicGrammarTopics.length - 1 ? arabicGrammarTopics[idx + 1] : null;
  const a = accentStyles[topic.accent];
  const Icon = topicIcons[topic.id] ?? BookOpen;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" className="h-8 -ml-2 gap-1 text-muted-foreground" asChild>
          <Link to="/arabic-grammar">
            <ChevronLeft className="h-4 w-4" />
            All topics
          </Link>
        </Button>
        <span className="text-border">/</span>
        <span className="text-foreground font-medium truncate">{topic.titleEn}</span>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 p-6 sm:p-8 shadow-md ring-1",
          a.card,
          a.ring,
        )}
      >
        <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90", a.banner)} />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2", a.badge)}>
            <Icon className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{topic.titleEn}</h1>
            <p className="mt-1 text-xl sm:text-2xl font-['Amiri',serif] text-primary font-medium" dir="rtl">
              {topic.titleAr}
            </p>
            <p className="mt-2 text-sm text-muted-foreground max-w-prose">{topic.cardSummary}</p>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">In this lesson</h2>
        <div className="space-y-4 rounded-xl border bg-muted/20 px-5 py-5 text-[15px] leading-relaxed text-muted-foreground">
          {topic.body.map((para, i) => (
            <p key={i}>{renderBoldSegments(para)}</p>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <MessageSquareQuote className="h-5 w-5 text-primary shrink-0" />
          Examples (Arabic + notes)
        </h2>
        <div className="space-y-4">
          {topic.examples.map((ex, i) => (
            <Card key={i} className={cn("overflow-hidden border-2 shadow-sm", a.exampleBg)}>
              <CardHeader className="pb-2 space-y-0">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Example {i + 1}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <p
                  className="text-2xl sm:text-[1.65rem] leading-loose font-['Amiri',serif] text-foreground text-right"
                  dir="rtl"
                >
                  {ex.arabic}
                </p>
                {ex.gloss && <p className="text-sm italic text-muted-foreground border-l-2 border-primary/30 pl-3">{ex.gloss}</p>}
                <p className="text-sm text-foreground/90 leading-relaxed">{renderBoldSegments(ex.explain)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Alert className="border-primary/25 bg-primary/5">
        <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle>Remember</AlertTitle>
        <AlertDescription className="text-foreground/90 leading-relaxed">{renderBoldSegments(topic.takeaway)}</AlertDescription>
      </Alert>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
        {prev ? (
          <Button variant="outline" className="gap-2 justify-start sm:justify-center" asChild>
            <Link to={`/arabic-grammar/${prev.id}`}>
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span className="truncate text-left">{prev.titleEn}</span>
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button className="gap-2 gold-gradient text-foreground border-0 shadow-sm justify-end sm:justify-center" asChild>
            <Link to={`/arabic-grammar/${next.id}`}>
              <span className="truncate text-right">{next.titleEn}</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function ArabicGrammar() {
  const { topicId } = useParams<{ topicId: string }>();

  if (topicId) {
    const topic = getGrammarTopic(topicId);
    if (!topic) {
      return <Navigate to="/arabic-grammar" replace />;
    }
    return (
      <DashboardLayout>
        <TopicLesson topic={topic} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <TopicHome />
    </DashboardLayout>
  );
}
