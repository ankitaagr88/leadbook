/**
 * LeadBook — insurance vertical seed data
 *
 * The only insurance-specific code in the whole system. Paste this into the
 * Apps Script project alongside Code.gs and Setup.gs, then run
 * setupMasterTemplate() — Setup.gs picks `SEED_PRODUCTS` up from the shared
 * global scope and writes it into the Products and DocTemplates tabs.
 *
 * Skip this file and the Sheet is built empty; the agent then adds her own
 * products from the Products screen. Either way she can edit, rename or switch
 * off anything seeded here — this is a starting point, not a fixed list.
 *
 * For another vertical, copy this file, change SEED_PRODUCTS, and change
 * nothing else anywhere.
 */

var SEED_PRODUCTS = [
  {
    name: 'Term Life',
    description: 'Pure life cover for a fixed term. High cover, low premium, no maturity payout.',
    docs: ['PAN Card', 'Aadhar Card', 'Photograph', 'Income Proof', 'Address Proof', 'Cancelled Cheque']
  },
  {
    name: 'Health Cover',
    description: 'Hospitalisation cover for an individual or family floater. Cashless at network hospitals.',
    docs: ['PAN Card', 'Aadhar Card', 'Photograph', 'Address Proof', 'Previous Policy Copy', 'Medical Reports']
  },
  {
    name: 'Motor Insurance',
    description: 'Car and two-wheeler cover. Own-damage plus third-party; renewed yearly.',
    docs: ['RC Copy', 'Previous Policy Copy', 'Driving Licence', 'Aadhar Card', 'PAN Card', 'Vehicle Photographs']
  },
  {
    name: 'Child Plan',
    description: 'Savings plan targeted at a child\'s education or marriage milestone.',
    docs: ['Parent\'s PAN Card', 'Parent\'s Aadhar Card', 'Child\'s Birth Certificate', 'Photograph', 'Income Proof', 'Cancelled Cheque']
  },
  {
    name: 'ULIP',
    description: 'Insurance plus market-linked investment. Suits longer horizons and tax planning.',
    docs: ['PAN Card', 'Aadhar Card', 'Photograph', 'Income Proof', 'Bank Statement', 'Cancelled Cheque']
  }
];
