// Starting points for new documents in the Document Hub.
export const DOC_TEMPLATES = [
  { id: 'leeg', label: 'Leeg document', category: '', content: '' },
  {
    id: 'sop',
    label: 'Werkwijze / procedure',
    category: 'Procedures',
    content: `<h2>Doel</h2><p>Waarom bestaat deze werkwijze?</p>
<h2>Wanneer gebruik je dit?</h2><p></p>
<h2>Stappen</h2><ol><li><p>Stap 1</p></li><li><p>Stap 2</p></li><li><p>Stap 3</p></li></ol>
<h2>Checklist</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Gecontroleerd</p></li></ul>
<h2>Verantwoordelijke</h2><p></p>`,
  },
  {
    id: 'voorstel',
    label: 'Offerte / voorstel',
    category: 'Verkoop',
    content: `<h2>Aanleiding</h2><p>Wat is de vraag van de klant?</p>
<h2>Ons voorstel</h2><p></p>
<h2>Planning</h2><ul><li><p>Start:</p></li><li><p>Oplevering:</p></li></ul>
<h2>Investering</h2><p>Bedrag excl. btw:</p>
<h2>Voorwaarden</h2><p>Geldig tot:</p>`,
  },
  {
    id: 'plan',
    label: 'Projectplan',
    category: 'Projecten',
    content: `<h2>Doel</h2><p>Wat willen we bereiken en hoe meten we dat?</p>
<h2>Scope</h2><p><strong>Wel:</strong></p><p><strong>Niet:</strong></p>
<h2>Mijlpalen</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Mijlpaal 1 · datum</p></li></ul>
<h2>Budget</h2><p></p>
<h2>Risico's</h2><ul><li><p></p></li></ul>`,
  },
  {
    id: 'pitch',
    label: 'Pitch / investeerdersverhaal',
    category: 'Fundraising',
    content: `<h2>Probleem</h2><p></p>
<h2>Oplossing</h2><p></p>
<h2>Markt</h2><p></p>
<h2>Tractie tot nu toe</h2><ul><li><p></p></li></ul>
<h2>Team</h2><p></p>
<h2>De vraag</h2><p>Bedrag, waarvoor, wat krijgt de investeerder?</p>`,
  },
  {
    id: 'kennis',
    label: 'Kennisbank / handleiding',
    category: 'Kennisbank',
    content: `<h2>Waar gaat dit over?</h2><p></p>
<h2>Hoe werkt het?</h2><p></p>
<h2>Veelgestelde vragen</h2><p><strong>Vraag:</strong></p><p><strong>Antwoord:</strong></p>
<h2>Links</h2><ul><li><p></p></li></ul>`,
  },
];
