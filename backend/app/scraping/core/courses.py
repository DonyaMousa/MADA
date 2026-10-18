"""EPOS table rows and link annotations, preserving course-specific uncertainty."""
import hashlib
import re
import pymupdf


def extract_epos_courses(content, url):
    courses = []
    with pymupdf.open(stream=content, filetype='pdf') as document:
        full_text = ' '.join(page.get_text() for page in document)
        intake = re.search(r'Intake every two years\s*[-–]\s*next intake\s*(20\d{2})', full_text, re.I)
        cycle = re.search(r'\b(20\d{2}/20\d{2})\b', full_text)
        category = None
        for page_number, page in enumerate(document, 1):
            links = page.get_links()
            for table in page.find_tables().tables:
                for index, cells in enumerate(table.extract()):
                    cells = [' '.join((c or '').split()) for c in cells]
                    if len(cells) < 7:
                        continue
                    name, institution, language, degree, duration, deadline, self_financing = cells[:7]
                    if not institution:
                        if name and not name.startswith('*'):
                            category = name
                        continue
                    if institution == 'Institution' or not degree or not duration:
                        continue
                    rect = pymupdf.Rect(table.rows[index].cells[0])
                    urls = list(dict.fromkeys(link['uri'] for link in links if link.get('uri')
                        and rect.intersects(link['from'])))
                    from ..schemas.scholarship import Block
                    from .timing import parse_deadlines
                    exact = parse_deadlines([Block(section='Application Procedure', heading_path=['Application deadline'],
                        kind='table_cell', text=deadline, source_url=f'{url}#page={page_number}', order=index)])
                    courses.append({'course_id': hashlib.sha256(f'{name}|{institution}'.encode()).hexdigest()[:20],
                        'name': name, 'institution': institution, 'subject_area': category,
                        'language': language, 'degree': degree, 'duration': duration,
                        'intake_cycle': cycle[1] if cycle else None,
                        'intake_condition': intake[0] if name.endswith('*') and intake else None,
                        'official_course_websites': urls, 'application_deadline': next((d.date for d in exact if d.date), None),
                        'application_deadline_original_text': deadline,
                        'self_financing_deadline_original_text': self_financing,
                        'deadline_status': 'requires_course_website_check' if 'see website' in deadline.lower() else 'needs_review',
                        'source_url': f'{url}#page={page_number}', 'source_row': cells,
                        'requires_human_review': True})
    return courses
