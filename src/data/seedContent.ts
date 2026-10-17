import type { HelpArticle } from '../domain/types'

export const seedArticles: HelpArticle[] = [
  {
    slug: 'searching-scholarships',
    kind: 'guide',
    title: { en: 'Searching with care', ar: 'البحث بعناية' },
    body: {
      en: 'Use the directory filters and natural-language search to shortlist programmes. Treat Mada as a map: every listing still requires the official provider page. Editorial guides are not eligibility rules.',
      ar: 'استخدم عوامل التصفية والبحث اللغوي لتقصير القائمة. مدّى خريطة وليست جهة تقديم. راجع الصفحة الرسمية دائمًا.',
    },
  },
  {
    slug: 'eligibility',
    kind: 'guide',
    title: { en: 'Reading eligibility', ar: 'قراءة شروط الأهلية' },
    body: {
      en: 'Hard rules (nationality, degree, named tests) are evaluated separately from suitability scores. A high score is not an admission chance. GPA is compared only on the same scale.',
      ar: 'القواعد الصارمة منفصلة عن درجة الملاءمة. الدرجة العالية ليست احتمال قبول. لا نحول معدلات GPA بين المقاييس.',
    },
  },
  {
    slug: 'deadlines',
    kind: 'guide',
    title: { en: 'Deadlines and timezones', ar: 'المواعيد والمناطق الزمنية' },
    body: {
      en: 'When a timezone is missing, Mada marks the deadline as uncertain. Opening Apply never records a submission.',
      ar: 'إذا غاب التوقيت الزمني نعتبر الموعد غير مؤكد. فتح رابط التقديم لا يسجّل أنك قدّمت.',
    },
  },
  {
    slug: 'documents',
    kind: 'guide',
    title: { en: 'Documents', ar: 'المستندات' },
    body: {
      en: 'Keep reusable files in your private vault and attach them to a specific application. Readiness is present, missing, or needs review — not a claim that a file satisfies a committee.',
      ar: 'احفظ الملفات في خزنتك الخاصة وأرفقها بطلب محدد. الجاهزية تعني موجود أو ناقص أو يحتاج مراجعة.',
    },
  },
  {
    slug: 'letters',
    kind: 'guide',
    title: { en: 'Statements of purpose', ar: 'خطابات الدافع' },
    body: {
      en: 'Draft in your voice. If AI review is unconfigured, Mada will say so instead of inventing a review.',
      ar: 'اكتب بصوتك. إذا كانت مراجعة الذكاء الاصطناعي غير مهيأة فسنخبرك بذلك صراحة.',
    },
  },
  {
    slug: 'interviews',
    kind: 'guide',
    title: { en: 'Interviews', ar: 'المقابلات' },
    body: {
      en: 'Interview formats differ. Use the official guidance and your community’s applicant tips, and remember peer advice is unofficial.',
      ar: 'تختلف المقابلات. اتبع الإرشاد الرسمي، ونصائح الأقران غير رسمية.',
    },
  },
  {
    slug: 'how-matching-works',
    kind: 'help',
    title: { en: 'How matching works', ar: 'كيف يعمل التطابق' },
    body: {
      en: 'See also docs/MATCHING.md in the repository. Personal scores need a profile; visitors can still search.',
      ar: 'راجع ملف التوثيق. البحث متاح للزائر أما الدرجات الشخصية فتحتاج ملفًا.',
    },
  },
  {
    slug: 'privacy-of-files',
    kind: 'help',
    title: { en: 'Who can see my files?', ar: 'من يرى ملفاتي؟' },
    body: {
      en: 'Only you. Communities cannot see CVs, letters, application status, or assistant chats.',
      ar: 'أنت فقط. المجتمعات لا ترى السيرة أو الخطابات أو حالة الطلب أو المحادثات.',
    },
  },
  {
    slug: 'faq-apply',
    kind: 'faq',
    title: { en: 'Does Mada submit my application?', ar: 'هل يقدّم مدّى الطلب عني؟' },
    body: {
      en: 'No. You apply on the provider’s official site. You may later record that you submitted.',
      ar: 'لا. التقديم على موقع الجهة. يمكنك لاحقًا تسجيل أنك قدّمت.',
    },
  },
]
