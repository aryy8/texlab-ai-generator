#!/usr/bin/env python3
"""
Generate a publication-grade PDF Software Requirements Specification (SRS) for texlab
strictly adhering to Karl E. Wiegers' (1999) template:
- Project name: texlab
- Authors: Aryan Rastogi (2427030083) & Raghav Sethi (2427030127)
- Includes UI screenshots (Landing Page, Workspace Desk)
- Includes all lab experiment diagrams (DFD 0, 1, 2, Sequence, Activity, State Transition, Package, Object)
- No copyright notice
- No syntax/ASCII diagrams
- Strictly under 10 pages total (Target: exactly 9 pages)
"""

import os
import sys
import shutil
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    HRFlowable,
    Image as RLImage,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and print running headers and footers.
    Page 1: Cover (no header/footer)
    Page 2: Page ii (TOC & Revision History)
    Page 3+: Body Page 1 to N
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages):
        page_num = self._pageNumber
        self.saveState()

        # Page 1: Cover page (no header, no footer)
        if page_num == 1:
            self.restoreState()
            return

        # Page 2: Front matter (Table of Contents & Revision History)
        if page_num == 2:
            self.setFont("Helvetica-Oblique", 8)
            self.setFillColor(colors.HexColor("#334155"))
            self.drawString(54, 752, "Software Requirements Specification for texlab")
            self.drawRightString(612 - 54, 752, "Page ii")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 746, 612 - 54, 746)

            self.line(54, 36, 612 - 54, 36)
            self.setFont("Helvetica", 7.5)
            self.setFillColor(colors.HexColor("#64748B"))
            self.drawString(54, 26, "texlab — Version 1.0 approved")
            self.drawRightString(612 - 54, 26, "Page ii")
            self.restoreState()
            return

        # Main Body: Page 3 onwards (labeled as Page 1 to N)
        body_page = page_num - 2
        body_total = total_pages - 2

        # Running Header
        self.setFont("Helvetica-Oblique", 8)
        self.setFillColor(colors.HexColor("#334155"))
        self.drawString(54, 752, "Software Requirements Specification for texlab")
        self.drawRightString(612 - 54, 752, f"Page {body_page}")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 746, 612 - 54, 746)

        # Running Footer
        self.line(54, 36, 612 - 54, 36)
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(54, 26, "texlab — Version 1.0 approved")
        self.drawRightString(612 - 54, 26, f"Page {body_page} of {body_total}")
        self.restoreState()


def build_compact_srs_pdf(output_pdf_path: str):
    # Printable area: Letter 612 x 792 pt. Margins 54 pt (0.75 in). Width = 504 pt, Height = 684 pt.
    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=52,
        bottomMargin=50,
    )

    styles = getSampleStyleSheet()

    style_cover_title = ParagraphStyle(
        "CoverTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=28,
        leading=34,
        textColor=colors.HexColor("#0F172A"),
        alignment=TA_CENTER,
    )

    style_cover_for = ParagraphStyle(
        "CoverFor",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=15,
        leading=20,
        textColor=colors.HexColor("#475569"),
        alignment=TA_CENTER,
    )

    style_cover_project = ParagraphStyle(
        "CoverProject",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=26,
        leading=32,
        textColor=colors.HexColor("#1E3A8A"),
        alignment=TA_CENTER,
    )

    style_cover_meta = ParagraphStyle(
        "CoverMeta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=17,
        textColor=colors.HexColor("#1E293B"),
        alignment=TA_CENTER,
    )

    style_h1 = ParagraphStyle(
        "SRS_H1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11.5,
        leading=14.5,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=7,
        spaceAfter=3,
        keepWithNext=True,
    )

    style_h2 = ParagraphStyle(
        "SRS_H2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11.5,
        textColor=colors.HexColor("#1E3A8A"),
        spaceBefore=5,
        spaceAfter=2,
        keepWithNext=True,
    )

    style_body = ParagraphStyle(
        "SRS_Body",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=7.8,
        leading=10.2,
        textColor=colors.HexColor("#1E293B"),
        spaceAfter=2.5,
        alignment=TA_LEFT,
    )

    style_caption = ParagraphStyle(
        "SRS_Caption",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#475569"),
        alignment=TA_CENTER,
        spaceAfter=3,
    )

    style_th = ParagraphStyle(
        "SRS_TH",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=9,
        textColor=colors.white,
        alignment=TA_LEFT,
    )

    style_td = ParagraphStyle(
        "SRS_TD",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=7,
        leading=8.8,
        textColor=colors.HexColor("#1E293B"),
        alignment=TA_LEFT,
    )

    style_toc_item = ParagraphStyle(
        "SRS_TOC",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#1E293B"),
    )

    img_dir = "/Users/aryan/texlab-ai-generator/docs/images"
    story = []

    # ==================== PAGE 1: COVER PAGE ====================
    story.append(Spacer(1, 40))
    story.append(HRFlowable(width="100%", thickness=4, color=colors.HexColor("#0F172A"), spaceAfter=50))
    story.append(Spacer(1, 60))
    story.append(Paragraph("Software Requirements<br/>Specification", style_cover_title))
    story.append(Spacer(1, 24))
    story.append(Paragraph("for", style_cover_for))
    story.append(Spacer(1, 20))
    story.append(Paragraph("texlab", style_cover_project))
    story.append(Spacer(1, 100))
    story.append(
        Paragraph(
            "<b>Version 1.0 approved</b><br/><br/>"
            "<b>Prepared by:</b><br/>"
            "Aryan Rastogi (2427030083)<br/>"
            "Raghav Sethi (2427030127)<br/><br/>"
            "<b>Organization:</b> texlab Project<br/><br/>"
            "<b>Date Created:</b> October 20, 2026",
            style_cover_meta,
        )
    )
    story.append(Spacer(1, 60))
    story.append(PageBreak())

    # ==================== PAGE 2: TABLE OF CONTENTS & REVISION HISTORY (Page ii) ====================
    story.append(Paragraph("Table of Contents", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#2E6B8A"), spaceAfter=4))

    toc_data = [
        ("Table of Contents", "ii"),
        ("Revision History", "ii"),
        ("1. Introduction", "1"),
        ("   1.1 Purpose, 1.2 Document Conventions, 1.3 Intended Audience", "1"),
        ("   1.4 Product Scope, 1.5 References", "1"),
        ("2. Overall Description", "1"),
        ("   2.1 Product Perspective, 2.2 Product Functions", "1"),
        ("   2.3 User Classes and Characteristics", "1"),
        ("   2.4 Operating Environment & Design Constraints", "2"),
        ("   2.6 User Documentation & 2.7 Dependencies", "2"),
        ("3. External Interface Requirements", "2"),
        ("   3.1 User Interfaces (with Landing Page & Workspace Screenshots)", "2"),
        ("   3.2 Hardware, 3.3 Software & 3.4 Communications Interfaces", "2"),
        ("4. System Features", "3"),
        ("   4.1 Natural Language to LaTeX Generation & Multimodal Input", "3"),
        ("   4.2 Fine-Grained Generation Preferences Steering", "3"),
        ("   4.3 Automated Prompt Keyword & Style Detection", "3"),
        ("   4.4 Interactive Dual-Pane Workspace & Live Compilation Preview", "3"),
        ("   4.5 Remote LaTeX Compilation Proxy & Log Capture", "3"),
        ("   4.6 Autonomous Compile-Error Diagnostics & Multi-Pass Auto-Repair", "3"),
        ("   4.7 Raster-Based Column Fit Validation & Auto-Fit Refinement", "3"),
        ("   4.8 Curated Figure Template Library & Parametric Editing", "3"),
        ("   4.9 Multi-Agent Session Management & Local Figure Version History", "3"),
        ("   4.10 Multi-Destination Export (Clipboard, Overleaf Integration, ZIP)", "3"),
        ("   4.11 Semantic Moderation, Security Gate, & Prompt Injection Defense", "3"),
        ("5. Other Nonfunctional Requirements", "4"),
        ("   5.1 Performance, 5.2 Safety & 5.3 Security Requirements", "4"),
        ("   5.4 Software Quality Attributes & 5.5 Business Rules", "4"),
        ("6. Other Requirements (Database, Internationalization, Legal)", "4"),
        ("Appendix A: Glossary", "4"),
        ("Appendix B: Analysis Models", "5"),
        ("   B.1 Level 0 DFD, B.2 Level 1 DFD, B.3 Level 2 DFD", "5"),
        ("   B.4 Sequence Diagram, B.5 Activity Diagram, B.6 State Transition Diagram", "6"),
        ("   B.7 Package Diagram, B.8 Object Diagram", "7"),
        ("Appendix C: To Be Determined List", "7"),
    ]

    toc_rows = []
    for item, pg in toc_data:
        is_top = not item.startswith(" ")
        txt = f"<b>{item}</b>" if is_top else f"&nbsp;&nbsp;&nbsp;&nbsp;{item.strip()}"
        toc_rows.append([
            Paragraph(txt, style_toc_item),
            Paragraph(f"<b>{pg}</b>" if is_top else pg, ParagraphStyle("TOCPg", parent=style_toc_item, alignment=TA_RIGHT)),
        ])

    toc_table = Table(toc_rows, colWidths=[450, 54])
    toc_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 0.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ])
    )
    story.append(toc_table)
    story.append(Spacer(1, 10))

    story.append(Paragraph("Revision History", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#2E6B8A"), spaceAfter=4))

    rev_header = [
        Paragraph("Name", style_th),
        Paragraph("Date", style_th),
        Paragraph("Reason For Changes", style_th),
        Paragraph("Version", style_th),
    ]
    rev_row = [
        Paragraph("Aryan Rastogi (2427030083)<br/>Raghav Sethi (2427030127)", style_td),
        Paragraph("2026-10-20", style_td),
        Paragraph("Formal Software Requirements Specification release conforming to Karl E. Wiegers template with UI screenshots, DFDs, sequence, activity, state transition, package, and object diagrams.", style_td),
        Paragraph("1.0 approved", style_td),
    ]
    rev_table = Table([rev_header, rev_row], colWidths=[120, 55, 265, 64])
    rev_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2E6B8A")),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    story.append(rev_table)
    story.append(PageBreak())

    # ==================== PAGE 3 (BODY PAGE 1): SECTIONS 1 & 2 ====================
    story.append(Paragraph("1. Introduction", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#2E6B8A"), spaceAfter=3))

    story.append(Paragraph("1.1 Purpose & Scope", style_h2))
    story.append(Paragraph(
        "This Software Requirements Specification (SRS) details the requirements for <b>texlab</b> (Version 1.0), an intelligent, web-based natural language to publication-grade LaTeX generator. texlab converts natural-language descriptions and sketches into valid TikZ diagrams, booktabs tables, amsmath equations, and PGFPlots charts. The platform guarantees compliance with IEEE two-column (8.5 cm) bounds via raster fit validation, offloads compilation to texlive.net without local TeX dependencies, performs autonomous multi-pass compilation repair, and enables direct exports to Overleaf and ZIP archives.",
        style_body
    ))

    story.append(Paragraph("1.2 Document Conventions & Audience", style_h2))
    story.append(Paragraph(
        "Conforms to Karl E. Wiegers (1999) SRS template and IEEE Std 830-1998. Statements follow RFC 2119 keywords (SHALL, SHOULD, MAY). Functional requirements use <code>REQ-FeatureNumber.SequenceNumber</code>. Target audience includes frontend/UI developers, backend/cloud engineers, prompt engineers, QA testers, and academic researchers.",
        style_body
    ))

    story.append(Paragraph("1.3 References", style_h2))
    story.append(Paragraph(
        "1. Wiegers, K. E., <i>SRS Template</i>, 1999. 2. IEEE Std 830-1998. 3. Tantau, T., <i>TikZ & PGF Manual v3.1.10</i>, 2023. 4. OpenRouter AI Documentation. 5. Texlive.net Latexcgi Service. 6. Overleaf API Documentation.",
        style_body
    ))

    story.append(Paragraph("2. Overall Description", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#2E6B8A"), spaceAfter=3))

    story.append(Paragraph("2.1 Product Perspective & Functions", style_h2))
    story.append(Paragraph(
        "texlab is a decoupled web application comprising a React 18 / Vite SPA and a Node.js serverless proxy layer. Compilation is executed remotely via texlive.net latexcgi (pdflatex standalone engine), and AI inference is routed via OpenRouter (gpt-4o-mini, gemini-2.5-flash/pro). Core functions: Natural language parsing, multimodal sketch ingestion (up to 4 images), keyword intent detection, preference-steered formatting, curated template catalog with parametric editing, remote compilation proxy, autonomous compiler error repair, raster-based canvas column fit validation, multi-agent workspace tabs, local version history (up to 30 figures), and multi-format export.",
        style_body
    ))

    story.append(Paragraph("2.2 User Classes and Characteristics", style_h2))
    user_header = [Paragraph("User Class", style_th), Paragraph("Frequency", style_th), Paragraph("Technical Expertise & Key Functions", style_th), Paragraph("Priority", style_th)]
    user_rows = [
        [Paragraph("Academic Researchers", style_td), Paragraph("Daily/Weekly", style_td), Paragraph("Advanced LaTeX; limited TikZ. Requires publication figures strictly fitting IEEE 8.5 cm column margins; heavy Overleaf export.", style_td), Paragraph("Highest", style_td)],
        [Paragraph("Students & Educators", style_td), Paragraph("Periodic", style_td), Paragraph("Intermediate LaTeX; novice TikZ. Generates thesis diagrams, project timelines, and homework equations; relies on templates and auto-repair.", style_td), Paragraph("High", style_td)],
        [Paragraph("Software & ML Engineers", style_td), Paragraph("Frequent", style_td), Paragraph("Advanced software; intermediate LaTeX. Generates neural topologies, architectures, and comparison tables; utilizes sketch uploads.", style_td), Paragraph("High", style_td)],
        [Paragraph("Technical Writers", style_td), Paragraph("Bi-weekly", style_td), Paragraph("Moderate LaTeX. Converts whiteboard drawings into clean vector charts; utilizes standalone ZIP bundles and monochrome modes.", style_td), Paragraph("Medium", style_td)],
    ]
    user_table = Table([user_header] + user_rows, colWidths=[105, 55, 285, 59])
    user_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2E6B8A")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
            ("TOPPADDING", (0, 0), (-1, -1), 1.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(user_table)
    story.append(PageBreak())

    # ==================== PAGE 4 (BODY PAGE 2): SECTIONS 2.4-2.7 & SECTION 3 ====================
    story.append(Paragraph("2.3 Operating Environment & Constraints", style_h2))
    story.append(Paragraph(
        "• <b>Operating Environment:</b> Modern web browsers (Chrome 110+, Firefox 115+, Safari 16.4+, Edge 110+) with Canvas/Fetch API. Serverless Node.js 18.x/20.x runtime.<br/>"
        "• <b>Design Constraints:</b> Stateless execution (60s timeout); zero local TeX toolchains; texlive.net CORS avoidance via <code>/api/compile-latex</code> proxy; standalone pdflatex class only; payload limits (4,000 prompt chars, 200,000 LaTeX chars, 12 MB ZIP, 4 image attachments).<br/>"
        "• <b>Documentation & Dependencies:</b> Repository documentation (<code>README.md</code>, <code>ARCHITECTURE.md</code>, <code>library/STYLE.md</code>) and template previews. External dependencies: OpenRouter, texlive.net, Upstash Redis, Overleaf API.",
        style_body
    ))

    story.append(Paragraph("3. External Interface Requirements", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#2E6B8A"), spaceAfter=3))

    story.append(Paragraph("3.1 User Interfaces", style_h2))
    story.append(Paragraph(
        "texlab implements a clean, high-contrast, responsive interface built with Tailwind CSS, Lucide icons, and Radix UI primitives. It features: (1) <b>Landing Page (<code>/</code>)</b> with centered hero prompt card, format triggers (Diagram, Table, Equation, Plot), multimodal image attachment, and curated template catalog carousel; (2) <b>Workspace Desk (<code>/app</code>)</b> featuring AI chat and iterative refinement on the left, and tabbed live PDF preview (PDF.js) and LaTeX source editor on the right.",
        style_body
    ))

    ui_landing_path = os.path.join(img_dir, "ui_landing_page.png")
    ui_workspace_path = os.path.join(img_dir, "ui_workspace.png")

    landing_img = RLImage(ui_landing_path, width=238, height=184)
    workspace_img = RLImage(ui_workspace_path, width=238, height=131)

    ui_table = Table(
        [
            [landing_img, workspace_img],
            [Paragraph("Figure 3.1: texlab Landing Page with Input Card & Template Gallery", style_caption),
             Paragraph("Figure 3.2: texlab Workspace Desk with Left Chat & Right Live Preview", style_caption)]
        ],
        colWidths=[252, 252]
    )
    ui_table.setStyle(
        TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ])
    )
    story.append(ui_table)

    story.append(Paragraph("3.2 Hardware, Software & Communication Interfaces", style_h2))
    story.append(Paragraph(
        "• <b>Hardware Interfaces:</b> Pointing devices, touch screens (canvas pan/zoom), and retina/high-DPI pixel ratio scaling.<br/>"
        "• <b>Software Interfaces:</b> OpenRouter LLM API (HTTPS POST, Bearer auth, gpt-4o-mini, gemini-2.5-flash/pro); Texlive.net Latexcgi (multipart/form-data, pdflatex); Overleaf API (POST form with base64 snip_uri); Upstash Redis (REST pipeline API for rate limits and moderation).<br/>"
        "• <b>Communications:</b> TLS 1.3 encryption. Security response headers: X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy.",
        style_body
    ))
    story.append(PageBreak())

    # ==================== PAGE 5 (BODY PAGE 3): SECTION 4 (SYSTEM FEATURES) ====================
    story.append(Paragraph("4. System Features", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#2E6B8A"), spaceAfter=3))

    features_text = [
        ("4.1 Natural Language to LaTeX & Multimodal Input", "High",
         "Converts text prompts and up to 4 reference sketches into valid LaTeX code. <b>REQ-1.1:</b> Accept prompts up to 4,000 characters and 4 reference images. <b>REQ-1.2:</b> Route requests with images exclusively to vision-capable models. <b>REQ-1.3:</b> Sanitize output by stripping markdown fences and commentary. <b>REQ-1.4:</b> Sanitized HTTP 502/504 errors on upstream timeouts."),

        ("4.2 Fine-Grained Generation Preferences Steering", "High",
         "Controls structural and aesthetic formatting options. <b>REQ-2.1:</b> Support output types (diagram, table, equation, plot) and sub-styles (flowchart, architecture, neural-net, timeline, hierarchy, comparison, ablation). <b>REQ-2.2:</b> Support palettes: academic (tlblue, tlteal, tlorange, tlpurple, tlgray), monochrome, pastel, vivid. <b>REQ-2.3:</b> Support canvas aspect ratios: auto, square (1:1 boustrophedon), landscape, portrait, wide. <b>REQ-2.4:</b> Support fits: standalone, snippet, column (8.5 cm bound), fullpage (17 cm bound)."),

        ("4.3 Automated Prompt Keyword & Style Detection", "Medium",
         "Infers output type and sub-style from prompt keywords. <b>REQ-3.1:</b> Scored regex matching executes debounced as user types; specific domain phrases outrank generic single tokens."),

        ("4.4 Interactive Dual-Pane Workspace & Live Compilation Preview", "High",
         "Split desk interface for real-time authoring. <b>REQ-4.1:</b> Left pane handles conversational chat and prompt revisions. <b>REQ-4.2:</b> Right pane switches between Live PDF Preview (rendered via pdfjs-dist with 50%–200% zoom/pan) and syntax-highlighted LaTeX source editor."),

        ("4.5 Remote LaTeX Compilation Proxy & Log Capture", "High",
         "Proxies LaTeX source to texlive.net latexcgi without client-side toolchains. <b>REQ-5.1:</b> Wrap snippet bodies in standalone document preamble with preloaded packages (tikz, pgfplots, amsmath, booktabs, xcolor). <b>REQ-5.2:</b> Stream PDF binary (HTTP 200) on success; return TeX log text with HTTP 422 on failure within 45s timeout."),

        ("4.6 Autonomous Compile-Error Diagnostics & Multi-Pass Auto-Repair", "High",
         "Autonomously resolves LaTeX syntax errors. <b>REQ-6.1:</b> Intercept 422 compilation errors, extract '!'-prefixed error lines, and dispatch up to 2 auto-repair iterations with mode='repair'. <b>REQ-6.2:</b> Relocate misplaced keys, declare missing packages/colors, and fix undefined node coordinates."),

        ("4.7 Raster-Based Column Fit Validation & Auto-Fit Refinement", "High",
         "Inspects rasterized preview canvas bounding box pixels to verify academic column width compliance. <b>REQ-7.1:</b> Pixel scanner locates non-white bounding pixels; if content touches right margin (marginRight < 0.012), status is marked 'cropped'. <b>REQ-7.2:</b> Autonomously trigger one fit-refine pass to scale, reflow, or wrap TikZ nodes."),

        ("4.8 Curated Figure Template Library & Parametric Editing", "Medium",
         "Provides publication-grade templates in library/catalog.json. <b>REQ-8.1:</b> matchLibraryTemplate matches prompts to proven craft patterns for neural nets, flowcharts, architectures, and comparison tables."),

        ("4.9 Multi-Agent Session Management & Local Figure Version History", "Medium",
         "Multi-tab workflows without remote accounts. <b>REQ-9.1:</b> Persist up to 30 figures with version trees (latex, label, timestamps) in browser localStorage. <b>REQ-9.2:</b> Restore previous version snapshots instantly upon chip selection."),

        ("4.10 Multi-Destination Export (Clipboard, Overleaf Integration, ZIP Bundles)", "High",
         "Diverse export pipelines. <b>REQ-10.1:</b> Copy paste-ready snippets formatted for columnwidth or textwidth. <b>REQ-10.2:</b> Download structured ZIP containing figure.tex, snippet.tex, preamble.tex, <slug>.tex, and README.txt. <b>REQ-10.3:</b> Open projects in Overleaf via base64 data URIs (<1.5 MB) or server tokenized snip URIs."),

        ("4.11 Semantic Moderation, Security Gate, & Prompt Injection Defense", "High",
         "Guards against abuse and jailbreaks. <b>REQ-11.1:</b> Enforce figure-only allowlist via Llama Guard / GPT-4o-mini (cached in Redis for 600s). <b>REQ-11.2:</b> leaksSystemPrompt() inspects model outputs for canary tokens, replacing leaks with '% Request declined.'. <b>REQ-11.3:</b> Enforce sliding-window rate limiting per IP and cookie (texlab_rl)."),
    ]

    for title, prio, desc in features_text:
        story.append(Paragraph(f"<b>{title}</b> &mdash; <i>Priority: {prio}</i>", style_h2))
        story.append(Paragraph(desc, style_body))

    story.append(PageBreak())

    # ==================== PAGE 6 (BODY PAGE 4): SECTIONS 5 & 6 & APPENDIX A ====================
    story.append(Paragraph("5. Other Nonfunctional Requirements", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#2E6B8A"), spaceAfter=3))

    story.append(Paragraph("5.1 Performance Requirements", style_h2))
    story.append(Paragraph(
        "• <b>NFR-PERF-1:</b> Remote compilation via <code>/api/compile-latex</code> SHALL complete within <b>3.0s</b> under nominal conditions.<br/>"
        "• <b>NFR-PERF-2:</b> Initial code generation via OpenRouter SHALL return within <b>15.0s</b> for standard figures.<br/>"
        "• <b>NFR-PERF-3:</b> PDF preview canvas re-rendering upon zoom/pan SHALL execute at <b>60 fps</b> with redraw latency < <b>50 ms</b>.<br/>"
        "• <b>NFR-PERF-4:</b> Total production JavaScript transfer size for initial landing SHALL not exceed <b>350 KB</b> gzipped.",
        style_body
    ))

    story.append(Paragraph("5.2 Safety Requirements", style_h2))
    story.append(Paragraph(
        "• <b>NFR-SAFE-1:</b> Block generation of actionable weapon designs, chemical/biological threats, or malware attack flows.<br/>"
        "• <b>NFR-SAFE-2:</b> Workspace continuously serializes prompts and code to localStorage, guaranteeing zero loss across crashes.<br/>"
        "• <b>NFR-SAFE-3:</b> Preview canvases explicitly release image buffers and revoke Blob object URLs to prevent memory leaks.",
        style_body
    ))

    story.append(Paragraph("5.3 Security Requirements", style_h2))
    story.append(Paragraph(
        "• <b>NFR-SEC-1:</b> Server-side API keys (OPEN_ROUTER_API, UPSTASH_REDIS_REST_TOKEN) SHALL NEVER be transmitted to browsers.<br/>"
        "• <b>NFR-SEC-2:</b> Sliding-window rate limits enforced per IP and cookie (texlab_rl): Generation: 8/min burst, 40/hr, 100/day; Compile: 30/min burst, 200/hr, 500/day. Exceeding returns HTTP 429 Retry-After.<br/>"
        "• <b>NFR-SEC-3:</b> Preferences strictly validated against hardcoded string whitelists before prompt interpolation.",
        style_body
    ))

    story.append(Paragraph("5.4 Software Quality Attributes & 5.5 Business Rules", style_h2))
    story.append(Paragraph(
        "• <b>Quality Attributes:</b> 99.9% uptime via Vercel Edge; first-pass compile success >= 92% (rising to >= 98% after auto-repair); automatic multi-model fallback on provider rate limits; first-time user time-to-figure < 60 seconds.<br/>"
        "• <b>Business Rules:</b> BR-1: Strictly scoped to technical/academic LaTeX figures; non-figure chat queries rejected. BR-2: Fast models (gpt-4o-mini, gemini-2.5-flash) prioritized for drafts/repairs; heavy models (gemini-2.5-pro) reserved for complex figures. BR-3: Core generation operates without mandatory user login.",
        style_body
    ))

    story.append(Paragraph("6. Other Requirements", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#2E6B8A"), spaceAfter=3))
    story.append(Paragraph(
        "• <b>6.1 Database & Caching:</b> Upstash Redis stores rate limit windows and SHA-256 moderation hashes (TTL: 600s). In-memory Map fallback when Redis is unconfigured.<br/>"
        "• <b>6.2 Internationalization:</b> UTF-8 character encoding throughout; non-ASCII characters converted to compatible TeX macros or inputenc.<br/>"
        "• <b>6.3 Legal & Licensing:</b> Distributed under the MIT License. Generated LaTeX output imposes no copyleft encumbrances on user research papers.",
        style_body
    ))

    story.append(Paragraph("Appendix A: Glossary", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#2E6B8A"), spaceAfter=3))
    glossary_header = [Paragraph("Term", style_th), Paragraph("Definition", style_th)]
    glossary_rows = [
        [Paragraph("AST", style_td), Paragraph("Abstract Syntax Tree; structured hierarchical representation of code syntax.", style_td)],
        [Paragraph("Booktabs", style_td), Paragraph("LaTeX package providing publication-grade typographic rules for tables without vertical rules.", style_td)],
        [Paragraph("Latexcgi", style_td), Paragraph("Online compilation CGI service hosted by texlive.net converting TeX POST source into binary PDFs.", style_td)],
        [Paragraph("LLM", style_td), Paragraph("Large Language Model (e.g., GPT-4o, Gemini 2.5) providing natural language reasoning and code synthesis.", style_td)],
        [Paragraph("Overleaf", style_td), Paragraph("Collaborative cloud-based LaTeX authoring platform with direct project import capabilities.", style_td)],
        [Paragraph("PDF.js", style_td), Paragraph("Open-source HTML5/WebAssembly PDF rendering engine developed by Mozilla.", style_td)],
        [Paragraph("Pdflatex", style_td), Paragraph("Standard TeX engine compiling TeX/LaTeX directly into Adobe Portable Document Format.", style_td)],
        [Paragraph("PGFPlots", style_td), Paragraph("High-level LaTeX package built on TikZ for drawing publication-quality 2D and 3D scientific plots.", style_td)],
        [Paragraph("Standalone", style_td), Paragraph("LaTeX document class (\\documentclass{standalone}) auto-clipping page size exactly to content bounding box.", style_td)],
        [Paragraph("TikZ", style_td), Paragraph("Powerful declarative vector graphics language for producing high-precision technical diagrams in TeX.", style_td)],
    ]
    glossary_table = Table([glossary_header] + glossary_rows, colWidths=[90, 414])
    glossary_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2E6B8A")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(glossary_table)
    story.append(PageBreak())

    # ==================== PAGE 7 (BODY PAGE 5): APPENDIX B (DATA FLOW DIAGRAMS 0, 1, 2) ====================
    story.append(Paragraph("Appendix B: Analysis Models &mdash; Data Flow Diagrams", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#2E6B8A"), spaceAfter=3))

    story.append(Paragraph("B.1 Level 0 Data Flow Diagram (DFD Level 0)", style_h2))
    story.append(Paragraph("Represents texlab as a single process interacting with external entities (User, AI Model / LaTeX Compiler).", style_body))
    dfd0_path = os.path.join(img_dir, "dfd_level_0.png")
    story.append(RLImage(dfd0_path, width=470, height=100))
    story.append(Paragraph("Figure B.1: Level 0 Data Flow Diagram (Context View)", style_caption))
    story.append(Spacer(1, 2))

    story.append(Paragraph("B.2 Level 1 Data Flow Diagram (DFD Level 1)", style_h2))
    story.append(Paragraph("Decomposes texlab into primary processes: prompt capture, code generation, compilation, and result display.", style_body))
    dfd1_path = os.path.join(img_dir, "dfd_level_1.png")
    story.append(RLImage(dfd1_path, width=470, height=155))
    story.append(Paragraph("Figure B.2: Level 1 Data Flow Diagram (Decomposed Major Processes)", style_caption))
    story.append(Spacer(1, 2))

    story.append(Paragraph("B.3 Level 2 Data Flow Diagram (DFD Level 2)", style_h2))
    story.append(Paragraph("Detailed internal pipeline: prompt validation, AI request dispatching, code generation, compiler execution, and preview rendering.", style_body))
    dfd2_path = os.path.join(img_dir, "dfd_level_2.png")
    story.append(RLImage(dfd2_path, width=470, height=103))
    story.append(Paragraph("Figure B.3: Level 2 Data Flow Diagram (Detailed Internal Operations)", style_caption))
    story.append(PageBreak())

    # ==================== PAGE 8 (BODY PAGE 6): APPENDIX B (SEQUENCE, ACTIVITY, STATE DIAGRAMS) ====================
    story.append(Paragraph("Appendix B: Analysis Models &mdash; Behavioral & Interaction Models", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#2E6B8A"), spaceAfter=3))

    story.append(Paragraph("B.4 Sequence & B.5 Activity Diagrams", style_h2))
    story.append(Paragraph("Chronological message flows across system actors and end-to-end execution workflow from prompt input to error recovery.", style_body))

    seq_path = os.path.join(img_dir, "sequence_diagram.png")
    act_path = os.path.join(img_dir, "activity_diagram.png")
    seq_img = RLImage(seq_path, width=310, height=262)
    act_img = RLImage(act_path, width=155, height=290)

    seq_act_table = Table(
        [
            [seq_img, act_img],
            [Paragraph("Figure B.4: Sequence Diagram for texlab Generation & Compilation Flow", style_caption),
             Paragraph("Figure B.5: Activity Diagram for Request Workflow & Error Recovery", style_caption)]
        ],
        colWidths=[325, 179]
    )
    seq_act_table.setStyle(
        TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ])
    )
    story.append(seq_act_table)
    story.append(Spacer(1, 2))

    story.append(Paragraph("B.6 State Transition Diagram", style_h2))
    story.append(Paragraph("Lifecycle states of a generation request: Idle, PromptEntered, Validating, Generating, CodeReady, Compiling, PreviewReady, Error.", style_body))
    state_path = os.path.join(img_dir, "state_transition_diagram.png")
    story.append(RLImage(state_path, width=470, height=214))
    story.append(Paragraph("Figure B.6: State Transition Diagram for LaTeX Generation Request Lifecycle", style_caption))
    story.append(PageBreak())

    # ==================== PAGE 9 (BODY PAGE 7): APPENDIX B (PACKAGE, OBJECT) & APPENDIX C ====================
    story.append(Paragraph("Appendix B: Analysis Models &mdash; Architectural & Object Structure", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#2E6B8A"), spaceAfter=3))

    story.append(Paragraph("B.7 Package Diagram", style_h2))
    story.append(Paragraph("Logical package architecture illustrating module dependencies across UserInterface, PromptProcessing, AICodeGeneration, LaTeXCompilation, PreviewAndExport, and APIServices.", style_body))
    pkg_path = os.path.join(img_dir, "package_diagram.png")
    story.append(RLImage(pkg_path, width=320, height=242))
    story.append(Paragraph("Figure B.7: Package Diagram for texlab Application Architecture", style_caption))
    story.append(Spacer(1, 4))

    story.append(Paragraph("B.8 Object Diagram", style_h2))
    story.append(Paragraph("Runtime object snapshot during active code generation, showing collaborating entity instances.", style_body))
    obj_path = os.path.join(img_dir, "object_diagram.png")
    story.append(RLImage(obj_path, width=480, height=51))
    story.append(Paragraph("Figure B.8: Object Diagram representing Runtime System Snapshot during Generation", style_caption))
    story.append(Spacer(1, 6))

    story.append(Paragraph("Appendix C: To Be Determined List", style_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#2E6B8A"), spaceAfter=3))
    tbd_header = [Paragraph("Item ID", style_th), Paragraph("Section", style_th), Paragraph("Description of Open Issue / Enhancement", style_th), Paragraph("Target Milestone", style_th), Paragraph("Owner", style_th)]
    tbd_rows = [
        [Paragraph("TBD-1", style_td), Paragraph("2.5 / 6.1", style_td), Paragraph("Implementation of an authenticated cloud database for cross-device synchronized user figure libraries beyond localStorage.", style_td), Paragraph("v1.2", style_td), Paragraph("Cloud Team", style_td)],
        [Paragraph("TBD-2", style_td), Paragraph("3.3 / 4.5", style_td), Paragraph("Support for additional compilation engines (xelatex, lualatex) to allow arbitrary OpenType and system font rendering.", style_td), Paragraph("v1.3", style_td), Paragraph("Backend Team", style_td)],
        [Paragraph("TBD-3", style_td), Paragraph("4.10", style_td), Paragraph("Direct client-side SVG vector extraction from compiled PDFs via pdf2svg WebAssembly module for HTML embed snippets.", style_td), Paragraph("v1.2", style_td), Paragraph("Frontend Team", style_td)],
        [Paragraph("TBD-4", style_td), Paragraph("5.3", style_td), Paragraph("Migration of all ephemeral in-memory rate-limiter fallback buckets to globally shared Redis instances across all regions.", style_td), Paragraph("v1.1", style_td), Paragraph("DevOps Team", style_td)],
        [Paragraph("TBD-5", style_td), Paragraph("4.1", style_td), Paragraph("Support for audio / speech-to-text prompt transcription for hands-free whiteboard-to-LaTeX figure authoring.", style_td), Paragraph("v2.0", style_td), Paragraph("AI Research", style_td)],
    ]
    tbd_table = Table([tbd_header] + tbd_rows, colWidths=[40, 45, 269, 75, 75])
    tbd_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2E6B8A")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
            ("TOPPADDING", (0, 0), (-1, -1), 1.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(tbd_table)

    # Build PDF
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated PDF at: {output_pdf_path}")

    # Mirror to artifact directory
    artifact_dir = "/Users/aryan/.gemini/antigravity-ide/brain/92a446b2-dfc6-4f3a-b41d-a376ae04a364"
    if os.path.exists(artifact_dir):
        artifact_pdf_path = os.path.join(artifact_dir, "SRS.pdf")
        shutil.copyfile(output_pdf_path, artifact_pdf_path)
        print(f"Successfully mirrored PDF to artifact path: {artifact_pdf_path}")


if __name__ == "__main__":
    pdf_file = "/Users/aryan/texlab-ai-generator/docs/SRS.pdf"
    if len(sys.argv) > 1:
        pdf_file = sys.argv[1]
    build_compact_srs_pdf(pdf_file)
