/**
 * Arabic grammar lessons (naḥw) — student-facing copy with examples.
 */

export type GrammarExample = {
  arabic: string;
  gloss?: string;
  explain: string;
};

export type GrammarAccent = "emerald" | "teal" | "cyan" | "sky" | "amber" | "orange" | "violet" | "rose" | "slate" | "lime" | "fuchsia";

export type GrammarTopic = {
  id: string;
  titleEn: string;
  titleAr: string;
  cardSummary: string;
  accent: GrammarAccent;
  body: string[];
  examples: GrammarExample[];
  takeaway: string;
};

export const arabicGrammarTopics: GrammarTopic[] = [
  {
    id: "aqsam-al-kalam",
    titleEn: "The three parts of speech",
    titleAr: "أقسام الكلام",
    cardSummary: "Every Arabic word is either a noun, a verb, or a particle — the key to reading any sentence.",
    accent: "emerald",
    body: [
      "Think of Arabic words as belonging to **three lockers**: **ism** (name / noun-like), **fiʿl** (action in time), and **ḥarf** (connector that needs a partner). Teachers call this **أقسام الكلام** — it is always the first chapter in traditional books.",
      "**Why it matters:** Once you spot the **fiʿl**, you can look for who did the action (فاعل) and what was affected (مفعول). Once you spot a **ḥarf** like **في** or **لن**, you immediately ask: *what word does this particle work with?*",
    ],
    examples: [
      {
        arabic: "الرجلُ قامَ.",
        gloss: "The man stood.",
        explain: "**الرجلُ** is an **ism** (subject, marfūʿ). **قامَ** is a **fiʿl** (past verb). There is no standalone **ḥarf** here — a simple verbal sentence (جملة فعلية).",
      },
      {
        arabic: "في البيتِ.",
        gloss: "In the house.",
        explain: "**في** is a **ḥarf جر**; it **needs** the noun **البيتِ** (majūr after في). A ḥarf never sits “finished” alone in meaning.",
      },
      {
        arabic: "وَ جاءَ أخُوكَ.",
        gloss: "And your brother came.",
        explain: "**وَ** links sentences or phrases (**حرف عطف**). **جاءَ** is the **fiʿl**; **أخُوكَ** is an **ism** (subject with a possessive suffix).",
      },
    ],
    takeaway: "Start every sentence scan with: *Is this word naming something (ism), doing something in time (fiʿl), or linking/marking (ḥarf)?*",
  },
  {
    id: "ism",
    titleEn: "Al-ism — nouns & noun phrases",
    titleAr: "الاسم",
    cardSummary: "Words for people, things, ideas, and roles in the sentence — with gender, number, and definiteness.",
    accent: "teal",
    body: [
      "An **ism** names a meaning **without tying it to past / present / command** the way a verb does. Adjectives behaving like descriptions (**نعت**) still follow the noun in **gender, number, definiteness, and case**.",
      "**Definite vs indefinite:** **الْقَلَمُ** (the pen) is **maʿrifa**; **قَلَمٌ** (a pen) is **nakira** with nunation in many positions. Names of people and places are usually definite by themselves.",
      "**Jobs in the sentence:** Same word shape can be subject (**فاعل** / **مبتدأ**), object (**مفعول به**), after a preposition (**مجرور**), second word in **إضافة**, and more — **iʿrāb** (ending vowels) tells you the job.",
    ],
    examples: [
      {
        arabic: "طالبٌ مجتهدٌ",
        gloss: "A diligent student (two words, both indefinite, masculine singular).",
        explain: "Both are **ism**; the second describes the first (**نعت**). Endings show **rafʿ** (nominative) in the indefinite triptote pattern.",
      },
      {
        arabic: "الدَّرسُ الجديدُ",
        gloss: "The new lesson.",
        explain: "**الدَّرسُ** definite (**معرفة**); **الجديدُ** matches it (definite adjective). Both **marfūʿ** here as a noun phrase.",
      },
      {
        arabic: "رأيتُ طالبَينِ مجتهدَينِ.",
        gloss: "I saw two diligent students.",
        explain: "**طالبَينِ** and **مجتهدَينِ** are **mansūb** (accusative) as objects of **رأيتُ** — dual endings **ـينِ** after a transitive verb.",
      },
    ],
    takeaway: "If it can take **الـ**, accept **تنوين**, or show as subject/object after a verb, you are almost always looking at an **ism** (or a phrase built around one).",
  },
  {
    id: "fil",
    titleEn: "Al-fiʿl — verbs overview",
    titleAr: "الفعل",
    cardSummary: "Past, present, and command — Arabic packs *time* into the verb pattern.",
    accent: "cyan",
    body: [
      "Arabic verbs are grouped by **root** (usually three letters) and **pattern** (وزن) like **فَعَلَ / يَفْعَلُ / افْعَلْ**. Meaning changes with pattern: simple action, making someone do something (**أفْعَلَ**), seeking (**افْتَعَلَ**), and so on.",
      "**Transitive (متعدٍ)** verbs take a direct object (**مفعول به**); **intransitive (لازم)** verbs complete their meaning without one, e.g. **نامَ** “he slept”.",
    ],
    examples: [
      {
        arabic: "كَتَبَ الطالبُ الدرسَ.",
        gloss: "The student wrote the lesson.",
        explain: "**كَتَبَ** = past **fiʿl**. **الطالبُ** = doer (**فاعل**, marfūʿ). **الدرسَ** = object (**مفعول**, mansūb with fatḥa).",
      },
      {
        arabic: "يَذْهَبُ الوَلدُ إلى المدرسةِ.",
        gloss: "The boy goes to the school.",
        explain: "**يَذْهَبُ** = **muḍāriʿ** (present/future). **إلى** introduces the place with **المدرسةِ** in **jarr**.",
      },
    ],
    takeaway: "Ask: *Who is the action for? When did it happen? Does this verb need an object to make sense?*",
  },
  {
    id: "maazi",
    titleEn: "The past tense (al-māḍī)",
    titleAr: "الماضي",
    cardSummary: "Completed action — built on fixed endings you can memorize like a table song.",
    accent: "sky",
    body: [
      "The **māḍī** tells you the action is **done** from the speaker’s view: **ذَهَبَ** “he went”, **ذَهَبَتْ** “she went”. In most forms the verb is **mabnī** (fixed ending sound) while people change with suffixes: **كتبتُ، كتبتَ، كتبتِ، كتبنا…**",
      "Weak verbs (**معتلّ**) change the last vowels or letters — start with sound verbs (**صحيح**) until the pattern feels easy.",
    ],
    examples: [
      { arabic: "فَهِمَ.", gloss: "He understood.", explain: "3rd masculine singular past — ending vowel is fixed (**مبني على الفتح** in the sound verb analysis)." },
      { arabic: "فَهِمْتَ.", gloss: "You (m.) understood.", explain: "**ـتَ** carries “you” — still past, still completed." },
      { arabic: "ما ذَهَبَا.", gloss: "They (two) did not go.", explain: "**ما** + past verb negates past; dual subject agreement is learned with the dual pronoun on the verb." },
    ],
    takeaway: "Past = **finished story**. Build confidence with one root (like **ك-ت-ب**) across all persons before mixing roots.",
  },
  {
    id: "mudari",
    titleEn: "The present (al-muḍāriʿ)",
    titleAr: "المضارع",
    cardSummary: "Ongoing or future action — watch for رفع / نصب / جزم after particles.",
    accent: "amber",
    body: [
      "The **muḍāriʿ** begins with **ي، ت، أ، ن** attached to the stem: **يَكْتُبُ** “he writes / will write”. It can be **marfūʿ** (default), **mansūb** after particles like **أنْ** or **لن**, or **majzūm** after **لم** or in **lam** of prohibition patterns.",
      "Think of particles as **traffic lights** for the last vowel of the present verb.",
    ],
    examples: [
      { arabic: "يَفْهَمُ الطالبُ.", gloss: "The student understands.", explain: "**يَفْهَمُ** = **marfūʿ** indicative — neutral statement." },
      { arabic: "لن يَفْهَمَ.", gloss: "He will not understand.", explain: "**لن** requires **نصب** → **يَفْهَمَ** with fatḥa on the last visible letter in the full paradigm." },
      { arabic: "لم يَفْهَمْ.", gloss: "He did not understand.", explain: "**لم** requires **جزم** → sukūn on the last radical in sound verbs (**يَفْهَمْ**)." },
    ],
    takeaway: "After you spot **لن / أنْ / كي / لام التعليل**, expect **naṣb** on the muḍāriʿ; after **لم / لام الأمر**, expect **jazm**.",
  },
  {
    id: "amr",
    titleEn: "The command (al-amr)",
    titleAr: "الأمر",
    cardSummary: "Tell someone to do something — clipped from the present stem.",
    accent: "orange",
    body: [
      "From **يَفْعَلُ** you often derive **اِفْعَلْ** “do!” for one male addressee. Women / groups have their own endings (**افْعَلي، افْعَلوا…**).",
      "Negative commands often use **لَا** + **muḍāriʿ** or special prohibition patterns your teacher will drill.",
    ],
    examples: [
      { arabic: "اِقْرَأْ!", gloss: "Read! (m.s.)", explain: "Command from **يَقْرَأُ** — initial hamza + sukūn pattern for Form I sound command." },
      { arabic: "اُكْتُبِ الدرسَ.", gloss: "Write the lesson. (f.s.)", explain: "**اُكْتُبِ** shows feminine singular command ending; object **الدرسَ** is **mansūb**." },
    ],
    takeaway: "Command verbs are short and direct — memorize the **أنتَ** line of the present, then learn the clipping rules your chart shows.",
  },
  {
    id: "harf",
    titleEn: "Particles (ḥurūf)",
    titleAr: "الحروف",
    cardSummary: "Little words that *steer* big meaning — jar, naṣb, jazm, and linking.",
    accent: "violet",
    body: [
      "A **ḥarf** does not complete a useful meaning until it **sticks** to another word: **منْ** needs a genitive phrase, **لَن** needs a **mansūb** present, **وَ** connects two units.",
      "Students often memorize tables: **حروف الجر** (take jarr), **النواصب** (take naṣb on what follows), **الجوازم** (take jazm on the present), etc.",
    ],
    examples: [
      { arabic: "منَ البيتِ", gloss: "From the house", explain: "**منَ** is **ḥarf جر** → next word **البيتِ** is **majūr** with kasra." },
      { arabic: "أنْ يَجْتَهِدَ", gloss: "That he should strive (subjunctive sense)", explain: "**أنْ** is **nāṣib** for the following **muḍāriʿ** → **يَجْتَهِدَ** with fatḥa (in the full manṣūb shape)." },
      { arabic: "في يَوْمٍ عَصِيبٍ", gloss: "On a difficult day", explain: "**في** takes **جَرّ** → **يَوْمٍ** with kasra; **عَصِيبٍ** adjective agrees in case and indefiniteness." },
    ],
    takeaway: "Whenever you see a tiny word, ask: *Does this put the next noun in جر, the next verb in نصب or جزم, or only connect?*",
  },
  {
    id: "zameer",
    titleEn: "Pronouns (ẓamāʾir)",
    titleAr: "الضمائر",
    cardSummary: "Stand-ins for people and things — attached to verbs, nouns, and particles.",
    accent: "rose",
    body: [
      "**Detached pronouns** (**منفصلة**) like **هُوَ، نَحنُ** often introduce the topic. **Attached pronouns** (**متصلة**) glue to ends: **كِتابُكَ** “your book”, **رَأَيْتُهُ** “I saw him”.",
      "Possessive suffixes change how you read **إضافة**: **بيتُ زَيْدٍ** vs **بيتُهُ** — same idea “house of / his house” with different grammar patterns.",
    ],
    examples: [
      { arabic: "هُوَ طالبٌ.", gloss: "He is a student.", explain: "**هُوَ** pronoun topic; **طالبٌ** predicate (**خبر**) — both typically **marfūʿ** in a nominal sentence." },
      { arabic: "كتابُهُ جديدٌ.", gloss: "His book is new.", explain: "**ـهُ** = his, attached to **كتاب**; predicate **جديدٌ** agrees with **كتاب** in gender/number/case." },
      { arabic: "ذَهَبُوا.", gloss: "They went.", explain: "**ـوا** marks plural masculine on the past verb — pronoun built into the verb ending." },
    ],
    takeaway: "Read the **suffix** first on verbs and nouns — it often tells you *who* without repeating the name.",
  },
  {
    id: "irab",
    titleEn: "Iʿrāb — why endings change",
    titleAr: "الإعراب",
    cardSummary: "Rafʿ, naṣb, jarr, jazm — the ‘job’ of the word in the sentence.",
    accent: "slate",
    body: [
      "**Rafʿ** ≈ nominative roles (subject, default topic, default predicate in many nominal sentences). **Naṣb** ≈ accusative roles (object, **إنّ** name, some **حال** patterns…). **Jarr** ≈ genitive after prepositions and in **إضافة** second term.",
      "**Jazm** mainly cuts the energy of the **muḍāriʿ** after certain particles — visually often a **sukūn** on the last root letter for sound verbs.",
    ],
    examples: [
      { arabic: "جاءَ المُعَلِّمُ.", gloss: "The teacher came.", explain: "**المُعَلِّمُ** = **marfūʿ** subject after the verb (**فاعل** in verb-initial order)." },
      { arabic: "رَحَّبَ المُعَلِّمُ بالطُلَّابِ.", gloss: "The teacher welcomed the students.", explain: "**بالطُلَّابِ** = preposition **بِ** + **جَرّ** on the noun." },
      { arabic: "إنَّ اللهَ غَفورٌ رَحيمٌ.", gloss: "Indeed Allah is forgiving, merciful.", explain: "**اللهَ** after **إنَّ** is **mansūb**; **غَفورٌ رَحيمٌ** predicates are **marfūʿ**." },
    ],
    takeaway: "Do not memorize endings blindly — always ask *what job does this word have in this exact sentence?*",
  },
  {
    id: "mabni-murab",
    titleEn: "Mabnī vs muʿrab",
    titleAr: "المبني والمعرب",
    cardSummary: "Some endings are ‘locked’; others move with grammar rules.",
    accent: "lime",
    body: [
      "**Muʿrab** words **open** their last vowel to show case/mood. **Mabnī** words keep a **fixed** ending sound regardless of role — many past-tense verbs, pronouns, and some nouns in special categories.",
      "Knowing which is which saves you from “impossible” iʿrāb when reading Qurʾān and poetry.",
    ],
    examples: [
      { arabic: "هٰذَا بَيتٌ.", gloss: "This is a house.", explain: "**هٰذَا** is **mabnī** on **الفتح** in common analysis; **بَيتٌ** is **muʿrab** marfūʿ predicate." },
      { arabic: "ذَهَبْتُ.", gloss: "I went.", explain: "Past verbs for **أنا** are **mabnī** — the ending **ـتُ** is fixed; compare **ذَهَبَ / ذَهَبَتْ** for he/she with their own fixed shapes." },
    ],
    takeaway: "If the ending **never** flips when you try different sentences, treat the word as **mabnī** and learn its fixed vowel from the rule table.",
  },
  {
    id: "raf-nasb-jar",
    titleEn: "Signs of rafʿ, naṣb, jarr",
    titleAr: "علامات الإعراب",
    cardSummary: "Quick visual cues on the last letter — ḍamma, fatḥa, kasra, sukūn.",
    accent: "fuchsia",
    body: [
      "**Nouns (triptote):** indefinite **ـٌ / ـً / ـٍ** show rafʿ / naṣb / jarr clearly in careful reading. **Definite** nouns often show single harakat (**ُ / َ / ِ**) on the last letter.",
      "**Sound muḍāriʿ:** **rafʿ** often ḍamma on the last visible letter; **naṣb** fatḥa; **jazm** sukūn — weak verbs adjust predictably.",
    ],
    examples: [
      { arabic: "طالبٌ — طالبًا — طالبٍ", gloss: "student (nom.) — (acc.) — (gen.)", explain: "Same word, three jobs, three indefinite endings — classic classroom trio." },
      { arabic: "يَنْصُرُ — يَنْصُرَ — يَنْصُرْ", gloss: "he helps (ind.) — (subj.) — (jussive)", explain: "Same stem, three moods — compare your teacher’s color-coded chart." },
    ],
    takeaway: "Underline the **last moving letter** of each word — that is where Arabic usually “announces” the grammar job.",
  },
  {
    id: "extras",
    titleEn: "Useful bridges",
    titleAr: "مواضيع مفيدة",
    cardSummary: "Idāfa, kāna / inna families — patterns that show up everywhere in texts.",
    accent: "teal",
    body: [
      "**Idāfa:** possession / association chain: **كِتابُ المدرسةِ** “the school’s book” — first part **marfūʿ** here, second **majūr**.",
      "**Kāna** and sisters reshape a nominal sentence; **inna** and sisters pull the first noun to **naṣb** and lift the predicate to **rafʿ** — practice short five-word drills until it feels automatic.",
    ],
    examples: [
      { arabic: "بابُ الفصلِ.", gloss: "The door of the classroom.", explain: "**إضافة**: **بابُ** first term **marfūʿ**, **الفصلِ** second term **majūr**." },
      { arabic: "إنَّ الْعِلْمَ نافعٌ.", gloss: "Indeed knowledge is beneficial.", explain: "**إنَّ** pulls **الْعِلْمَ** to **naṣb**; the predicate **نافعٌ** stays **marfūʿ** — a pattern you will meet constantly in Qurʾān and hadith." },
    ],
    takeaway: "These “bridge” topics connect **simple** sentences to **real** paragraphs — revisit them every time reading feels harder.",
  },
];

export function getGrammarTopic(id: string | undefined): GrammarTopic | undefined {
  if (!id) return undefined;
  return arabicGrammarTopics.find((t) => t.id === id);
}
