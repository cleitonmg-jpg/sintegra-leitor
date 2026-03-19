# Leitor SINTEGRA - V9 Informatica

## Overview
A SINTEGRA file reader/processor that parses .txt files containing inventory records (registers 74 and 75) from Brazilian fiscal system. All processing happens client-side in the browser - no database needed.

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Express (minimal, only serves the frontend)
- **Data**: In-memory only, processed entirely in the browser per user session

## Key Features
- Drag & drop .txt SINTEGRA file upload
- Parses Record 74 (inventory movements) and Record 75 (product catalog)
- Displays items as editable cards with quantity, price, total
- Edit/delete individual items
- Search by product code or description
- Export to PDF (jspdf + jspdf-autotable) and Excel (xlsx/SheetJS)
- Company name from records 10/11

## File Structure
- `client/src/pages/home.tsx` - Main page with upload, card grid, search, export
- `client/src/lib/sintegra-parser.ts` - SINTEGRA file parsing logic
- `client/src/lib/export-utils.ts` - PDF and Excel export utilities
- `shared/schema.ts` - TypeScript types for inventory items

## SINTEGRA Record Format
- **Record 10**: Company info (CNPJ pos 3-16, Name pos 17-49)
- **Record 11**: Additional company info
- **Record 74**: Inventory (Date pos 3-10, Product Code pos 11-24, Qty pos 25-37, Price pos 38-50, Ownership pos 51)
- **Record 75**: Products (Code pos 19-32, Description pos 41-93, Unit pos 94-99)

## Dependencies
- jspdf + jspdf-autotable: PDF generation
- xlsx: Excel export
