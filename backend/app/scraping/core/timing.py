"""Source-grounded timing extraction. Partial dates never become invented days."""
import re
from datetime import datetime, timedelta, time
from zoneinfo import ZoneInfo
from ..schemas.scholarship import Deadline

MONTHS = {name.lower(): i for i, name in enumerate(
    ['January','February','March','April','May','June','July','August','September','October','November','December'], 1)}
MONTH = '|'.join(MONTHS)


def parse_deadlines(blocks, status=None):
    result, seen = [], {}
    timezone = 'Europe/Berlin' if any(re.search(r'CET|CEST', b.text) and '24.00' in b.text for b in blocks) else None
    for b in blocks:
        text, context = b.text, ' > '.join(b.heading_path)
        # A source paragraph can contain distinct selection and funding-start events.
        split = re.split(r'\s+for (?=funding starting)', text, flags=re.I)
        if len(split) == 2:
            parts = [b.model_copy(update={'text': split[0]}), b.model_copy(update={'text': split[1]})]
            for row in parse_deadlines(parts, status):
                row.evidence_references = [{'source_url': b.source_url, 'source_section': context, 'excerpt': text}]
                result.append(row)
            continue
        low = text.lower()
        if b.section == 'Linked PDF':
            continue  # Course-table dates require row scope, never programme-wide dates.
        timing_context = re.search(r'deadline|application period|opening|selection|start.*fund', context, re.I)
        timing_text = re.search(r'deadline|portal.*open|access.*open|selection (?:in|on)|start of funding|funding (?:begins|starts|starting)|scholarship.*starts', text, re.I)
        if not (timing_context or timing_text):
            continue
        # Degree age, residence and certificate age are eligibility/document rules.
        if re.search(r'residen|degree.*years|doctorate.*years|not older than|no older than', low):
            continue
        kind = ('selection' if re.search(r'selection (?:in|on)', low) else
            'scholarship_start' if re.search(r'start of funding|funding (?:begins|starts|starting)|scholarship.*starts', low) else
            'opening' if re.search(r'(?:portal|access|applications?).*(?:opens?|between)|opening', low) else
            'portfolio' if 'portfolio' in low else
            'supporting_documents' if re.search(r'(?:submit|upload|receive|hand in).*(?:documents|certificates)|(?:documents|certificates).*(?:submit|upload|receive|deadline)|notification of admission', low) else 'application')
        dates = []
        for m in re.finditer(r'\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b', text):
            try:
                dates.append(datetime(int(m[3]), int(m[2]), int(m[1])).date())
            except ValueError:
                pass
        month_year = re.search(r'\b(' + MONTH + r')\s+(20\d{2})\b', low)
        yearless = re.search(r'\b\d{1,2}\s+(?:' + MONTH + r')\b', low)
        relative = bool(re.search(r'(?:\d+|one|two|three|four|five|six)\s+(?:weeks?|days?|months?)\s+before.{0,80}deadline|(?:documents|certificates).{0,80}\bby\b.{0,40}(?:deadline|start)|submit.{0,60}\bby\b.{0,40}deadline|must submit this before the funding period begins', low))
        time_only = bool(re.search(r'(?:closes?|ends?).*24[.:]00|24[.:]00.*(?:last|deadline)', low))
        if not (dates or month_year or yearless or relative or time_only):
            continue
        values = dates or [None]
        for day in values:
            precision = 'day' if day else 'relative' if relative else 'month' if month_year else 'yearless' if yearless else 'time_only'
            row = Deadline(original_text=text, kind=kind, date=day.isoformat() if day else None,
                deadline_at=datetime.combine(day + timedelta(days=1), time(), ZoneInfo(timezone)) if day and timezone and kind == 'application' else None,
                timezone=timezone if kind == 'application' else None,
                certainty='confirmed' if day else 'typical_cycle' if re.search(r'annually|every year', low) else 'unknown',
                year_explicit=bool(day or month_year), date_precision=precision,
                year_month=f'{month_year[2]}-{MONTHS[month_year[1]]:02d}' if month_year and not day else None,
                relative_constraint=text if relative or time_only else None,
                source_url=b.source_url, source_section=context, applicant_status=status,
                evidence_references=[{'source_url': b.source_url, 'source_section': context, 'excerpt': text}])
            key = (kind, day, re.sub(r'\W+', ' ', low).strip(), status)
            if key in seen:
                for ref in row.evidence_references:
                    if ref not in seen[key].evidence_references:
                        seen[key].evidence_references.append(ref)
            else:
                seen[key] = row
                result.append(row)
    return result
