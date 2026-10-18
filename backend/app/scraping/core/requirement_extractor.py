import hashlib
import re
from ..schemas.requirements import Requirement, RequiredDocument

CATEGORIES = [
    ("residence", r"residen|citizenship|nationalit|country of (?:origin|application)|home country"),
    ("language", r"\blanguage\b|\bGerman\b|\bEnglish\b|ielts|toefl|testdaf|\bdsh\b|cefr"),
    ("academic_performance", r"\bgpa\b|\bgrades?\b|academic (?:achievement|performance)|above.average|excellent academic"),
    ("graduation_recency", r"(?:degree|doctorate|graduat).*(?:date back|last \w+ years|within.*years|more than.*years|years old)|start of your doctorate.*years"),
    ("residence", r"resid|citizenship|nationalit|country of (?:origin|application)|home country"),
    ("professional_experience", r"professional experience|work experience|employment"),
    ("research", r"research|supervis|proposal|doctoral|doctorate|post.doc"),
    ("university_admission", r"admission|admitted|entrance examination|audition"),
    ("portfolio", r"portfolio|work samples|video|recording|artistic"),
    ("previous_degree", r"degree|bachelor|master|academic background|discipline"),
    ("motivation", r"motivation|professional goals|leadership|extracurricular|social commitment"),
    ("funding_condition", r"fund|tuition|allowance|insurance|stipend"),
]
DOCS = [("publication_list", r"list of.{0,25}publications|publication list"), ("curriculum_vitae", r"curriculum vitae|\bCV\b"), ("motivation_letter", r"letter of motivation|motivation letter"),
    ("reference", r"letter of recommendation|reference from|letters? of reference|recommendation form"),
    ("admission_letter", r"letter of admission|admission letter|proof of admission"), ("supervision_confirmation", r"confirmation of supervision|supervisor.*confirmation|letter.*supervisor|confirmation from the academic host"),
    ("transcript", r"transcript|list of grades"), ("degree_certificate", r"degree certificate|university certificates"),
    ("language_certificate", r"proof of.*(?:language|proficiency)|language certificate|language.*proof"),
    ("reference", r"letter of recommendation|reference from|letters? of reference|recommendation form"),
    ("research_proposal", r"research proposal|description of.*research|research project.*proposal"),
    ("portfolio", r"work samples|portfolio|audio.video files|recorded pieces"),
    ("study_plan", r"study plan|study course profile|desired.*degree programmes|course profile"),
    ("translation", r"translations?"), ("employment_certificate", r"employment|professional experience.*proof|employer"),
    ("application_form", r"application form"), ("other", r"certificate|proof|confirmation|form ")]
NUM_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6}


def classify(block, status=None, country=None, category_override=None):
    text = block.text
    low = text.lower()
    context = " > ".join(block.heading_path)
    selection = bool(re.search(r"selection|evaluation|assessment", context, re.I))
    category = category_override or next((name for name, pattern in CATEGORIES if re.search(pattern, low)), "general")
    conditions = [text] if re.search(r"\bif\b|unless|depending|provided|under certain|for (?:applicants|candidates)|as a rule|by the time|at the time of", low) else []
    exceptions = [text] if re.search(r"except|exempt|unless|as a rule|normally|in individual cases|alternativ|\bor\b.*no degree", low) else []
    preferred = bool(re.search(r"desirable|preferred|advantageous|if possible|optional|recommended", low))
    mandatory = bool(re.search(r"\bmust\b|\brequired\b|mandatory|cannot|not eligible|no more than|at least|have not resided|may not", low))
    obligation = "informational" if selection else "mandatory" if mandatory else "preferred" if preferred else "uncertain"
    strength = "informational" if selection else "preferred" if preferred and not mandatory else "conditional" if conditions else "mandatory" if mandatory else "uncertain"
    rule_type, operator, value, unit = "descriptive", None, None, None
    if re.search(r"excellent|above.average|good knowledge|sufficient|quality|potential|artistic maturity|academic progress", low):
        rule_type = "qualitative"
    # Values are extracted only from an explicit statement, never from adjectives.
    gpa = re.search(r"\bGPA\b\s*(?:(?:of|is|must be|at least|minimum|:|>=|≥)\s*)*(\d(?:\.\d+)?)\s*(?:/|out of)\s*(\d(?:\.\d+)?)", text, re.I)
    if gpa:
        rule_type, value, unit = "numeric", {"minimum": float(gpa[1]), "scale": float(gpa[2])}, "GPA"
        operator = ">=" if re.search(r"at least|minimum|>=|≥", text, re.I) else None
    elif category in ("graduation_recency", "professional_experience", "residence"):
        quantity = re.search(r"\b(\d+|one|two|three|four|five|six)\s+(years?|months?)", low)
        if quantity:
            raw = quantity[1]
            value = int(raw) if raw.isdigit() else NUM_WORDS[raw]
            unit = quantity[2].rstrip("s")
            rule_type = "numeric"
            operator = ">=" if re.search("at least|minimum", low) else "<=" if re.search("not.*more|within|last|not date back", low) else None
    elif category == "language":
        scores = re.findall(r"\b(IELTS|TOEFL)\b[^.;]{0,35}?(\d+(?:\.\d+)?)", text, re.I)
        cefr = re.findall(r"\b[A-C][12]\b", text)
        if scores:
            rule_type, value, unit = "numeric", [{"test": t.upper(), "score": float(s)} for t, s in scores], "test_score"
            operator = ">=" if re.search("at least|minimum", low) else None
        elif cefr:
            rule_type, value, unit = "categorical", cefr, "CEFR"
    if conditions and rule_type == "descriptive":
        rule_type = "conditional"
    requirement_id = hashlib.sha256(f"{' '.join(text.casefold().split())}|{status}|{country}|{category}".encode()).hexdigest()[:20]
    return Requirement(requirement_id=requirement_id, category=category, original_text=text,
        normalized_meaning=text, rule_type=rule_type, requirement_strength=strength,
        operator=operator, value=value, unit=unit, conditions=conditions, exceptions=exceptions, obligation=obligation,
        evidence_references=[{"source_url": block.source_url, "source_section": context, "excerpt": text}],
        applies_to_applicant_status=status, country_of_application=country,
        source_url=block.source_url, source_section=context, evidence_excerpt=text,
        interpretation_confidence=0.92 if value is not None and operator else 0.65,
        requires_human_review=True), selection


def funding_rule_blocks(blocks):
    result, continuation = [], False
    for b in blocks:
        if not b.text.startswith('-'):
            continuation = False
        if re.search(r'only funded under the following conditions|funding for .*already started|cannot be (?:funded|granted)|support offers? (?:listed|german)', b.text, re.I):
            result.append(b)
            continuation = 'following conditions' in b.text
        elif continuation and b.text.startswith('-'):
            result.append(b)
    return result


def extract_requirements(blocks, status=None, country=None):
    raw, structured, selection, conditional, unresolved = [], [], [], [], []
    seen = {}
    funding_texts = {b.text for b in funding_rule_blocks(blocks)}
    for block in blocks:
        context = " ".join(block.heading_path)
        # Procedure instructions, document lists, benefits and PDF course tables are
        # separate collections, even when they contain words such as grade or must.
        relevant = (block.section == "Application requirements"
            or bool(re.search(r"who can apply|selection|eligibility", context, re.I)))
        if block.section in ("Application Procedure", "Submitting an application", "Linked PDF"):
            relevant = False
        if re.search(r"value|duration of.*fund|application documents|documents to", context, re.I):
            relevant = False
        if block.text in funding_texts or re.match(r'You can apply if you:\s*$|Please check if|Further information|In the section|The Typical Scholarship Holder|Support offer|Please note: For applicants', block.text, re.I):
            relevant = False
        if block.kind in ('h3', 'h4') or (block.kind != 'li' and len(block.text.split()) < 5):
            relevant = False
        # The selected DAAD page prints both age rules, even for a single status.
        if status and ((re.match(r'Doctoral students:', block.text) and 'postdoc' in status.lower()) or
                       (re.match(r'Postdocs:', block.text) and 'doctoral' in status.lower() and 'postdoc' not in status.lower())):
            relevant = False
        if status and ((re.match(r'are doing your doctorate', block.text, re.I) and 'postdoc' in status.lower()) or
                       (re.match(r'have already completed your doctorate \(post-doc', block.text, re.I) and 'postdoc' not in status.lower())):
            relevant = False
        if not relevant or len(block.text) < 18:
            continue
        requirement, is_selection = classify(block, status, country)
        raw.append(block)
        interpretations = [requirement]
        if requirement.category != "professional_experience" and re.search(r"professional experience|work experience", block.text, re.I):
            # Compound academic/experience paragraphs must retain their separate explicit work-duration rule.
            additional, _ = classify(block, status, country, category_override="professional_experience")
            if additional.value is not None:
                interpretations.append(additional)
        for interpreted in interpretations:
            if interpreted.requirement_id in seen:
                prior = seen[interpreted.requirement_id]
                for reference in interpreted.evidence_references:
                    if reference not in prior.evidence_references:
                        prior.evidence_references.append(reference)
                continue
            seen[interpreted.requirement_id] = interpreted
            (selection if is_selection else structured).append(interpreted)
            if interpreted.conditions or interpreted.requirement_strength == "conditional":
                conditional.append(interpreted)
            if interpreted.requires_human_review:
                unresolved.append(interpreted)
    return {"raw_requirements": raw, "structured_requirements": structured,
        "selection_criteria": selection, "conditional_requirements": conditional,
        "unresolved_requirements": unresolved}


def extract_documents(blocks, status=None):
    docs, seen, context = [], {}, None
    optional_section = False
    application_blocks = [b for b in blocks if b.section in ("Application Procedure", "Submitting an application")]
    translation = next((b.text for b in application_blocks if "translation" in b.text.lower() and "german" in b.text.lower()), None)
    certification = next((b.text for b in application_blocks if "certif" in b.text.lower() and "copies" in b.text.lower()), None)
    for block in application_blocks:
        text, low = block.text, block.text.lower()
        if re.fullmatch(r"optional\s*:?", low):
            optional_section = True
        if re.match(r"(?:a\)|b\)|for all applicants)", low):
            optional_section = False
        if re.match(r"(?:a\)|b\)|for all applicants|for a master|advanced studies without|\d\. [ab]\))", low) and not re.search(r'documents to (?:be )?upload', low):
            context = text
        if not re.search(r"application documents|documents to be|documents to upload", " ".join(block.heading_path), re.I):
            continue
        if re.match(r'Application documents may be scanned|If you submit documents in your national language', text, re.I):
            continue  # Global format/translation instructions are attached to each document.
        if status and 'postdoc' not in status.lower() and re.search(r'mandatory for postdocs', low):
            continue
        if status and 'postdoc' in status.lower() and re.search(r'\(for doctoral students\)', low):
            continue
        match = next(((name, re.search(pattern, text, re.I)) for name, pattern in DOCS if re.search(pattern, text, re.I)), None)
        if not match or len(text) < 10:
            continue
        reference = {'source_url': block.source_url, 'source_section': ' > '.join(block.heading_path), 'excerpt': text}
        if text in seen:
            if reference not in seen[text].evidence_references:
                seen[text].evidence_references.append(reference)
            continue
        name, found = match
        conditions = ([context] if context and not context.lower().startswith("for all") else [])
        if re.search(r"\bif\b|upon request|where applicable|when|for applicants|insofar|for doctoral students", low):
            conditions.append(text)
        optional = optional_section or bool(re.search(r"optional|other documents you think", low)) or (bool(re.search(r"if possible", low)) and not re.search(r"at least|must|required|two years", low))
        count_match = re.search(r"\b(one|two|three|\d)\s+(?:current\s+)?(?:letters? of recommendation|references?|recommendations?)", low)
        count = (int(count_match[1]) if count_match[1].isdigit() else NUM_WORDS[count_match[1]]) if count_match else None
        mandatory = False if optional else None if conditions else True
        if re.search(r'mandatory for postdocs|certificat.*employment.*at least two years', low):
            mandatory = True
        document = RequiredDocument(name=found.group(0), document_type=name,
            mandatory=mandatory,
            conditions=conditions, submission_stage="after portal submission / separate request" if "media database" in low else "DAAD portal / see original instructions",
            required_format="PDF" if re.search(r"\bpdf\b", low) else "mp4" if "mp4" in low else None,
            translation_requirements=translation, certification_requirements=certification,
            number_of_references=count, instructions=text, applicant_status=status,
            evidence_url=block.source_url, source_section=" > ".join(block.heading_path), evidence_references=[reference])
        docs.append(document)
        seen[text] = document
    return docs
