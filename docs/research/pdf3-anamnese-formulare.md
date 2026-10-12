# PDF 3: "2026-10-11 09-36.pdf" (intake and patient forms)

Source: OneDrive-AyantaAG/Ayanta Home - Dokumente/pain-therapy/. The file is a scan of 7 pages with no text layer, so the pages were read visually. The forms are blank. They come from the "Liebscher & Bracht Gesundheitszentrum Schweiz", run by Gesundheitszentrum Gut AG, which has locations in Mettmenstetten and Zürich.

## p1: Body chart
- Skeleton diagrams: front, back and side view, plus back views of the spine.
- Fields for "Becken" (pelvis) and "Statik" (posture).
- Pain scale from 1 ("Aah") to 10 ("schmerzhaft", painful).
- Foot diagrams: sole and top of each foot, plus right and left ankle views.

## p2: "Anamnese L&B-Patienten" (patient intake form)
- **Personal details:**
  - first and last name, gender (m/w/d), date of birth
  - address, phone and mobile, email
  - occupation, GP (Hausärzt:in)
  - emergency contact and phone
  - health or accident insurer, insurance number
- **Smoking:** smoker yes/no, years smoked, packs per day.
- **Conditions to tick:**
  - high blood pressure, high blood lipids, dizziness or fainting
  - orthopaedic: osteoporosis, arthrosis, rheumatism, other
  - internal medicine: cardiovascular, diabetes, asthma, allergies, other
- **Other medical information:**
  - further diagnoses, current medication, pregnancy
  - whether the patient is currently in medical or therapeutic treatment, and with which doctor
- **Legal:**
  - Liability waiver for the centre and the therapist.
  - Consent to data processing as set out in the patient information. This includes consent to unencrypted email for admin matters such as rescheduling.
  - Place, date and signature.
- **Note:** patients should report significant changes.

## p3: Pain history and assessment
- "SZ-Geschichte" (pain history): free text.
- "Schmerzabklärung" (pain assessment, only if needed), for up to 3 pains. For each pain:
  - location, quality, intensity, depth
  - pattern: intermittent, constant or varying
  - front and back body outlines to draw on
- "Zusammenhänge SZ 1-2-3": how pains 1 to 3 are connected.
- "SZ-Referenzen": test movements or positions that trigger the pain.

## p4: "Erfolgsprotokoll" (progress log, filled in by the patient)
- Patient, date and the exact location of the pain.
- Pain before treatment is always set to 100% as the reference. Pain right after treatment is entered as a % of that.
- Four follow-up points, each with a smiley rating (good, neutral, bad) and a note:
  - the first hours after treatment
  - the first night
  - day 1
  - day 2 until the next treatment

## p5: Patient information on L&B pain therapy
- The method relies on the patient's own responsibility. The sheet states that muscular-fascial tension causes about 90% of pain.
- Stretching plan: for 1 month, 6 times a week and twice a day, followed by a review.
- **Rules for success:**
  - Expect on average 3 to 5 treatments per pain area, with a strong reduction usual already in the first session.
  - Stretch every day.
  - Don't have other therapies at the same time.
  - Don't take painkillers, so that results can be judged. Strong medication such as morphine must not be stopped abruptly; agree any change with the doctor.
- **Possible reactions to Osteopressur:** bruises, sore points, and a temporary worsening within the first 24 hours.
- **What helps:** warm baths or showers, warm wraps, and stretching at intensity 8 to 9.

## p6: Privacy notice (Swiss data-protection law)
- **Controller:** Gesundheitszentrum Gut AG.
- **Legal basis:** the treatment contract and the law.
- **Contents of the patient record:**
  - personal, contact and insurance data
  - the information conversation
  - health data: anamnesis, diagnoses, findings and the course of therapy
- **Retention:** 20 years after the last treatment, longer only with explicit consent.
- **Disclosure:** only as the law allows or with consent. Data on unpaid bills goes to a debt-collection agency.
- **Patient rights:** withdraw consent, access and copy (normally free), data portability in a machine-readable format, correction, or a note on the record when accuracy is disputed.

## p7
An accidental photo of the floor with no content.

## Data-model notes
- **Patient record:** master data and intake fields as on p2.
- **Consents:** liability waiver, data processing and unencrypted email, each with signature and date.
- **Pain complaints:** up to 3 per patient, with location, quality, intensity, depth and pattern, plus body-chart markings.
- **Session progress log:** the residual % after treatment and the 4 follow-up ratings.
- **Data protection:** keep records for 20 years after the last treatment, and support export, correction and withdrawal of consent.
