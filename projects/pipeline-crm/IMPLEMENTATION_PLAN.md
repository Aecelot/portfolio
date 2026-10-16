# Pipeline-CRM Implementation Plan

> **Goal**: Build out Pipeline-CRM by adapting code from crm_custom, with comprehensive testing.
> **Approach**: Local development first, Firebase hosting last. Test each feature as built.

## Current Status (Updated 2026-02-14)

| Phase | Status |
|-------|--------|
| Phase 1: Foundation & Routing | **COMPLETE** |
| Phase 2: Dashboard | **COMPLETE** |
| Phase 3: Leads List | **COMPLETE** |
| Phase 4: Lead CRUD & Forms | **COMPLETE** |
| Phase 5: Pipeline Kanban | **COMPLETE** |
| Phase 6: Notes System | **COMPLETE** |
| Phase 7: Settings & Export | **COMPLETE** |
| Phase 8: Import & Polish | **COMPLETE** |
| Phase 9: Integration Testing | Pending |
| Phase 10: Firebase Hosting | Pending |

See [DEVLOG.md](./DEVLOG.md) for detailed implementation notes.

---

## Architecture Overview

| Aspect | crm_custom (Source) | Pipeline-CRM (Target) |
|--------|---------------------|-------------------------|
| Framework | React Admin + Material UI | React 19 + Tailwind + shadcn/ui |
| Routing | React Admin routes | React Router 7 |
| Drag & Drop | @hello-pangea/dnd | @dnd-kit |
| Data | Companies/Contacts/Deals | Leads (studio/investor) |
| State | React Admin hooks | Custom hooks (useLeads, usePipeline) |

**Key Insight**: Can't copy components directly due to framework differences. Must adapt business logic and patterns.

---

## Phase 1: Project Foundation & Routing

### 1.1 Test Infrastructure Setup
- [ ] Create `/tests` folder at project root
- [ ] Create `/tests/setup.ts` with Vitest + Testing Library config
- [ ] Create `/tests/mocks/firebase.ts` for Firebase mocking
- [ ] Update `vitest.config.ts` to use `/tests` folder
- [ ] Verify test runner works with `npm test`

**Adapt from**: `crm_custom/src/setupTests.js`, `crm_custom/vitest.config.ts`

### 1.2 Fix App.tsx with React Router
- [ ] Remove default Vite template code from `App.tsx`
- [ ] Add `BrowserRouter` wrapper
- [ ] Add `AuthProvider` wrapper
- [ ] Create route definitions for all pages
- [ ] Add protected route wrapper component
- [ ] Add redirect to login for unauthenticated users

**Routes to implement**:
```
/              → Dashboard
/leads         → Leads list
/leads/:id     → Lead detail
/pipeline/studios   → Studio Kanban
/pipeline/investors → Investor Kanban
/settings      → Settings
/login         → Login (exists)
```

### 1.3 Create ConfigContext
- [ ] Create `src/contexts/ConfigContext.tsx`
- [ ] Define configuration interface (lead types, priorities, stages, note statuses)
- [ ] Create `useConfig` hook
- [ ] Add default configuration values
- [ ] Wrap app with ConfigProvider

**Adapt from**: `crm_custom/src/root/ConfigurationContext.tsx`

### 1.4 Phase 1 Tests
- [ ] Test: Routes render correct components
- [ ] Test: Unauthenticated users redirected to login
- [ ] Test: ConfigContext provides values

**Test command**: `npm test -- tests/unit/routing.test.tsx`

---

## Phase 2: Dashboard Page

### 2.1 Create Dashboard Components
- [ ] Create `src/pages/Dashboard.tsx` (main page)
- [ ] Create `src/components/dashboard/StatsCards.tsx` (metrics overview)
- [ ] Create `src/components/dashboard/RecentLeads.tsx` (latest leads table)
- [ ] Create `src/components/dashboard/PipelineSummary.tsx` (mini pipeline view)
- [ ] Create `src/components/dashboard/ActivityFeed.tsx` (recent activity)

**Adapt patterns from**: `crm_custom/src/dashboard/Dashboard.tsx`

### 2.2 Add Activity Tracking
- [ ] Create `src/types/activity.ts` with Activity interface
- [ ] Add activity collection operations to `src/lib/firestore.ts`
- [ ] Create `src/hooks/useActivity.ts` hook
- [ ] Log activities on lead create/update/stage change

**Adapt from**: `crm_custom/src/providers/commons/activity.ts`

### 2.3 Dashboard Stats Logic
- [ ] Calculate total leads by type (studio/investor)
- [ ] Calculate leads by stage
- [ ] Calculate leads by priority
- [ ] Show recent leads (last 7 days)

### 2.4 Phase 2 Tests
- [ ] Test: StatsCards displays correct counts
- [ ] Test: RecentLeads shows latest entries
- [ ] Test: ActivityFeed renders activities
- [ ] Test: useActivity hook fetches data

**Test command**: `npm test -- tests/unit/dashboard/`

---

## Phase 3: Leads List Page

### 3.1 Add Required UI Components (shadcn/ui)
- [ ] Add Table component (`npx shadcn@latest add table`)
- [ ] Add Select component (`npx shadcn@latest add select`)
- [ ] Add Dialog component (`npx shadcn@latest add dialog`)
- [ ] Add DropdownMenu component (`npx shadcn@latest add dropdown-menu`)
- [ ] Add Tabs component (`npx shadcn@latest add tabs`)

### 3.2 Create Leads List Components
- [ ] Create `src/pages/Leads.tsx` (main page)
- [ ] Create `src/components/leads/LeadsTable.tsx` (data table)
- [ ] Create `src/components/leads/LeadsTableRow.tsx` (table row)
- [ ] Create `src/components/leads/LeadsFilters.tsx` (filter bar)
- [ ] Create `src/components/leads/LeadsBulkActions.tsx` (bulk operations)
- [ ] Create `src/components/leads/LeadsEmptyState.tsx` (no results)

**Adapt patterns from**: `crm_custom/src/contacts/ContactList.tsx`

### 3.3 Implement Filtering & Sorting
- [ ] Filter by type (studio/investor/all)
- [ ] Filter by status
- [ ] Filter by priority (high/medium/low/none)
- [ ] Filter by owner
- [ ] Sort by name, date created, priority
- [ ] Connect TopBar search to leads filter

### 3.4 Bulk Actions
- [ ] Select multiple leads (checkboxes)
- [ ] Bulk delete
- [ ] Bulk change status
- [ ] Bulk change priority

### 3.5 Phase 3 Tests
- [ ] Test: LeadsTable renders lead data
- [ ] Test: Filters update displayed leads
- [ ] Test: Search filters by name/email
- [ ] Test: Bulk selection works
- [ ] Test: Sorting changes order

**Test command**: `npm test -- tests/unit/leads/`

---

## Phase 4: Lead Detail & CRUD Forms

### 4.1 Add Form Components (shadcn/ui)
- [ ] Add Form component (`npx shadcn@latest add form`)
- [ ] Add Label component (`npx shadcn@latest add label`)
- [ ] Add Textarea component (`npx shadcn@latest add textarea`)
- [ ] Add RadioGroup component (`npx shadcn@latest add radio-group`)
- [ ] Install react-hook-form + zod for validation

### 4.2 Create Form Validation
- [ ] Create `src/lib/validators.ts`
- [ ] Add LinkedIn URL validator (adapt from `crm_custom/src/misc/isLinkedInUrl.ts`)
- [ ] Add lead form schema with zod
- [ ] Validate required fields, email format, URL format

### 4.3 Create Lead Detail Page
- [ ] Create `src/pages/LeadDetail.tsx` (main page)
- [ ] Create `src/components/leads/LeadHeader.tsx` (name, type, actions)
- [ ] Create `src/components/leads/LeadContactInfo.tsx` (contact section)
- [ ] Create `src/components/leads/LeadStudioInfo.tsx` (studio-specific)
- [ ] Create `src/components/leads/LeadInvestorInfo.tsx` (investor-specific)
- [ ] Create `src/components/leads/LeadTimeline.tsx` (activity history)

**Adapt patterns from**: `crm_custom/src/contacts/ContactShow.tsx`

### 4.4 Create Lead Form Components
- [ ] Create `src/components/forms/LeadForm.tsx` (main form wrapper)
- [ ] Create `src/components/forms/LeadBasicFields.tsx` (name, type, status, priority)
- [ ] Create `src/components/forms/LeadContactFields.tsx` (contact person details)
- [ ] Create `src/components/forms/LeadStudioFields.tsx` (size, focus, games)
- [ ] Create `src/components/forms/LeadInvestorFields.tsx` (type, regions, focus)

**Adapt patterns from**: `crm_custom/src/contacts/ContactInputs.tsx`

### 4.5 Create CRUD Dialogs
- [ ] Create `src/components/leads/LeadCreateDialog.tsx`
- [ ] Create `src/components/leads/LeadEditDialog.tsx`
- [ ] Create `src/components/leads/LeadDeleteDialog.tsx`
- [ ] Connect forms to useLeads hook CRUD operations

### 4.6 Phase 4 Tests
- [ ] Test: LeadDetail displays all fields
- [ ] Test: LeadForm validates required fields
- [ ] Test: Create lead saves to Firestore
- [ ] Test: Edit lead updates Firestore
- [ ] Test: Delete lead removes from Firestore
- [ ] Test: LinkedIn URL validation

**Test command**: `npm test -- tests/unit/forms/`

---

## Phase 5: Pipeline Kanban View

### 5.1 Adapt Pipeline Stage Logic
- [ ] Create `src/lib/stages.ts` with `getLeadsByStage` function
- [ ] Group leads by their pipeline stage
- [ ] Maintain stage order from pipeline config
- [ ] Handle leads with no stage assigned

**Directly adapt from**: `crm_custom/src/deals/stages.ts`

### 5.2 Create Pipeline Components
- [ ] Create `src/pages/PipelineView.tsx` (main page with type tabs)
- [ ] Create `src/components/pipeline/PipelineBoard.tsx` (Kanban container)
- [ ] Create `src/components/pipeline/PipelineColumn.tsx` (stage column)
- [ ] Create `src/components/pipeline/PipelineCard.tsx` (lead card)
- [ ] Create `src/components/pipeline/PipelineColumnHeader.tsx` (stage header)

**Adapt patterns from**: `crm_custom/src/deals/DealListContent.tsx`, `DealColumn.tsx`, `DealCard.tsx`

### 5.3 Implement @dnd-kit Drag & Drop
- [ ] Set up `DndContext` in PipelineBoard
- [ ] Create sensors (mouse, touch, keyboard)
- [ ] Make PipelineCard draggable with `useDraggable`
- [ ] Make PipelineColumn droppable with `useDroppable`
- [ ] Handle `onDragEnd` to move leads between stages
- [ ] Add drag overlay for visual feedback

**Key difference**: @hello-pangea/dnd → @dnd-kit API conversion

### 5.4 Implement Optimistic Updates
- [ ] Update local state immediately on drag end
- [ ] Call `updateLeadStage` from firestore.ts
- [ ] Rollback on error
- [ ] Show loading indicator during save

**Adapt from**: `crm_custom/src/deals/DealListContent.tsx` optimistic update pattern

### 5.5 Add Lead Ordering Within Stages
- [ ] Add `stageIndex` field to Lead type (or use timestamps)
- [ ] Handle reordering within same column
- [ ] Persist order to Firestore

### 5.6 Phase 5 Tests
- [ ] Test: getLeadsByStage groups correctly
- [ ] Test: PipelineBoard renders all columns
- [ ] Test: Drag between stages updates lead
- [ ] Test: Optimistic update shows immediately
- [ ] Test: Error rolls back changes

**Test command**: `npm test -- tests/unit/pipeline/`

---

## Phase 6: Notes System

### 6.1 Extend Data Model
- [ ] Add `LeadNote` type to `src/types/note.ts`
- [ ] Add notes collection operations to `src/lib/firestore.ts`
- [ ] Create `useNotes` hook for CRUD operations

### 6.2 Create Notes Components
- [ ] Create `src/components/notes/NotesList.tsx` (notes container)
- [ ] Create `src/components/notes/NoteCard.tsx` (individual note)
- [ ] Create `src/components/notes/NoteForm.tsx` (create/edit form)
- [ ] Create `src/components/notes/NoteStatusBadge.tsx` (cold/warm/hot)

**Adapt patterns from**: `crm_custom/src/notes/Note.tsx`, `NoteCreate.tsx`

### 6.3 Integrate Notes in Lead Detail
- [ ] Add notes section to LeadDetail page
- [ ] Show notes in reverse chronological order
- [ ] Allow adding new notes
- [ ] Allow editing/deleting notes

### 6.4 Phase 6 Tests
- [ ] Test: Notes display on lead detail
- [ ] Test: Create note adds to list
- [ ] Test: Edit note updates content
- [ ] Test: Delete note removes from list
- [ ] Test: Status badge shows correct color

**Test command**: `npm test -- tests/unit/notes/`

---

## Phase 7: Settings & Export

### 7.1 Create Settings Page
- [ ] Create `src/pages/Settings.tsx` (main page)
- [ ] Create profile view/edit section
- [ ] Create pipeline stage management (admin only)
- [ ] Create data export section
- [ ] Create app preferences section

**Adapt patterns from**: `crm_custom/src/settings/SettingsPage.tsx`

### 7.2 Implement Export Feature
- [ ] Create `src/hooks/useExport.ts` hook
- [ ] Create `src/components/settings/ExportDialog.tsx`
- [ ] Export all leads to Excel (xlsx)
- [ ] Export filtered leads
- [ ] Export by type (studios/investors)
- [ ] Include notes in export (optional)

**Use**: xlsx library (already installed)

### 7.3 Phase 7 Tests
- [ ] Test: Settings page renders sections
- [ ] Test: Profile edit saves changes
- [ ] Test: Export generates valid Excel file
- [ ] Test: Export respects filters

**Test command**: `npm test -- tests/unit/settings/`

---

## Phase 8: Import & Polish

### 8.1 Implement Import Feature
- [ ] Create `src/hooks/useImport.ts` hook
- [ ] Create `src/components/settings/ImportDialog.tsx`
- [ ] Parse Excel/CSV files
- [ ] Validate imported data
- [ ] Show preview before import
- [ ] Batch create leads
- [ ] Show progress and errors

**Adapt patterns from**: `crm_custom/src/contacts/useContactImport.tsx`

### 8.2 Add Tags System (Optional)
- [ ] Add `tags` support to Lead type (already in type)
- [ ] Create `src/components/common/TagChip.tsx`
- [ ] Create `src/components/common/TagsInput.tsx`
- [ ] Add tags filtering to leads list

### 8.3 Quick Actions
- [ ] Quick add lead from header
- [ ] Quick stage change from lead card context menu
- [ ] Keyboard shortcuts (Ctrl+N for new lead, etc.)

### 8.4 Performance Optimizations
- [ ] Add virtualization to leads list (if >100 leads)
- [ ] Memoize pipeline cards
- [ ] Lazy load routes
- [ ] Optimize Firestore queries with indexes

### 8.5 Phase 8 Tests
- [ ] Test: Import parses Excel correctly
- [ ] Test: Import validates data
- [ ] Test: Tags filtering works
- [ ] Test: Keyboard shortcuts trigger actions

**Test command**: `npm test -- tests/unit/import/`

---

## Phase 9: Integration Testing

### 9.1 Set Up Integration Tests
- [ ] Create `/tests/integration/` folder
- [ ] Set up Firebase emulator for tests
- [ ] Create test utilities for auth mocking

### 9.2 Write Integration Tests
- [ ] Test: Full lead CRUD workflow
- [ ] Test: Pipeline drag-drop with persistence
- [ ] Test: Notes CRUD on lead
- [ ] Test: Export generates downloadable file
- [ ] Test: Import creates leads in Firestore
- [ ] Test: Search + filter combination
- [ ] Test: Auth flow (login → dashboard → logout)

### 9.3 Test Coverage
- [ ] Generate coverage report
- [ ] Ensure >70% coverage on critical paths
- [ ] Document untested edge cases

**Test command**: `npm test -- tests/integration/`

---

## Phase 10: Firebase Hosting (LAST)

### 10.1 Firebase Configuration
- [ ] Complete Firebase config in `src/lib/firebase.ts` (add real keys)
- [ ] Create `.env.production` with production Firebase keys
- [ ] Create `firebase.json` with hosting config
- [ ] Create `.firebaserc` with project ID

### 10.2 Firestore Security Rules
- [ ] Create `firestore.rules` with proper access control
- [ ] Users can only read/write own leads (or if admin)
- [ ] Validate data structure in rules
- [ ] Test rules with Firebase emulator

### 10.3 Build & Deploy
- [ ] Run production build (`npm run build`)
- [ ] Test production build locally (`npm run preview`)
- [ ] Deploy to Firebase Hosting (`firebase deploy`)
- [ ] Verify deployed app works

### 10.4 CI/CD (Optional)
- [ ] Create GitHub Actions workflow
- [ ] Auto-deploy on push to main
- [ ] Run tests before deploy

---

## Files to Adapt from crm_custom

| Source File | What to Adapt | Target Location |
|-------------|---------------|-----------------|
| `src/deals/stages.ts` | Stage grouping logic | `src/lib/stages.ts` |
| `src/root/ConfigurationContext.tsx` | Context pattern | `src/contexts/ConfigContext.tsx` |
| `src/misc/isLinkedInUrl.ts` | Validation logic | `src/lib/validators.ts` |
| `src/providers/commons/activity.ts` | Activity logging | `src/lib/firestore.ts` |
| `src/deals/DealListContent.tsx` | Drag-drop patterns | `src/components/pipeline/` |
| `src/contacts/ContactInputs.tsx` | Form structure | `src/components/forms/` |
| `src/contacts/useContactImport.tsx` | Import logic | `src/hooks/useImport.ts` |
| `src/notes/Note.tsx` | Notes UI | `src/components/notes/` |

---

## Test File Structure

```
tests/
├── setup.ts                    # Vitest config, mocks
├── mocks/
│   ├── firebase.ts             # Firebase mock
│   └── leads.ts                # Test data
├── unit/
│   ├── routing.test.tsx
│   ├── dashboard/
│   │   ├── StatsCards.test.tsx
│   │   └── useActivity.test.ts
│   ├── leads/
│   │   ├── LeadsTable.test.tsx
│   │   └── LeadsFilters.test.tsx
│   ├── forms/
│   │   ├── LeadForm.test.tsx
│   │   └── validators.test.ts
│   ├── pipeline/
│   │   ├── stages.test.ts
│   │   └── PipelineBoard.test.tsx
│   ├── notes/
│   │   └── NoteCard.test.tsx
│   ├── settings/
│   │   └── useExport.test.ts
│   └── import/
│       └── useImport.test.ts
└── integration/
    ├── leadsCrud.test.tsx
    ├── pipelineDragDrop.test.tsx
    └── authFlow.test.tsx
```

---

## Verification

After each phase:
1. Run `npm test` - all tests pass
2. Run `npm run dev` - app works locally
3. Manual test the new feature in browser
4. Check browser console for errors

Final verification:
1. Run full test suite with coverage
2. Production build succeeds
3. All features work in preview mode
4. Deploy to Firebase and verify live

---

## Summary

| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| 1 | Foundation | Routing, tests, ConfigContext |
| 2 | Dashboard | Stats, activity feed |
| 3 | Leads List | Table, filters, search |
| 4 | Lead CRUD | Detail page, forms, validation |
| 5 | Pipeline | Kanban, drag-drop |
| 6 | Notes | Notes CRUD on leads |
| 7 | Settings | Export, preferences |
| 8 | Polish | Import, tags, performance |
| 9 | Testing | Integration tests, coverage |
| 10 | Deploy | Firebase hosting (LAST) |
