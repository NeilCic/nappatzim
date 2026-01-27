# UI/UX Improvements TODO

## Design System Foundation

### 1. Create Design System File
- [x] Create `mobile/src/shared/designSystem.js` with:
  - [ ] Spacing scale (4px, 8px, 12px, 16px, 24px, 32px, 48px)
  - [ ] Typography scale (heading, body, caption styles)
  - [ ] Color palette (primary, secondary, error, success, neutrals)
  - [x] Border radius values (sm: 4px, md: 8px, lg: 12px, xl: 16px, full: 999)
  - [x] Shadow presets (sm, md, lg, xl)
  - [ ] Animation constants (timing, spring configs)

### 2. Update Shared Styles
- [ ] Update `mobile/src/shared/styles.js` to use design system
- [ ] Ensure all components reference design system values

## Visual Polish & Consistency

### 3. Spacing Consistency
- [ ] Audit all screens for inconsistent spacing
- [ ] Replace magic numbers with design system spacing values
- [ ] Ensure consistent padding/margins across similar components

### 4. Typography Hierarchy
- [ ] Define 3-4 text styles (heading, body, caption)
- [ ] Update all Text components to use consistent typography
- [ ] Ensure proper font sizes and weights
- [ ] Set consistent line heights

### 5. Color Consistency
- [ ] Audit all hardcoded colors
- [ ] Replace with design system color palette
- [ ] Ensure consistent use of primary, secondary, error, success colors

### 6. Border Radius & Shadows
- [x] Create design system with standardized border radius and shadow presets
- [x] Update Button component to use design system
- [x] Update HomeScreen category cards to use design system
- [x] Update Modal component to use design system
- [x] Update floating scroll button to use design system
- [ ] Apply design system to remaining components (inputs, cards, etc.)

## Empty States

### 7. Empty State Components
- [ ] Create reusable `EmptyState` component
- [ ] Add empty states to:
  - [ ] HomeScreen (no categories)
  - [ ] Category workouts (no workouts)
  - [ ] Session history (no sessions)
  - [ ] Conversations (no messages)
  - [ ] Profile (no data sections)

### 8. Empty State Design
- [ ] Add helpful messages
- [ ] Include simple icons or illustrations
- [ ] Add action buttons where appropriate

## Loading States

### 9. Loading State Improvements
- [ ] Replace generic spinners with contextual messages
- [ ] Add skeleton screens for lists
- [ ] Improve loading feedback on buttons
- [ ] Add loading states to:
  - [ ] HomeScreen categories
  - [ ] Session lists
  - [ ] Profile data
  - [ ] Form submissions

## Micro-Interactions & Animations

### 10. Button Interactions
- [x] Add scale animations on press (floating scroll-to-bottom button in LayoutDetailScreen)
- [x] Create reusable AnimatedPressable component for consistent press feedback
- [x] Add press feedback to logout button
- [ ] Apply AnimatedPressable to other buttons throughout the app
- [ ] Improve disabled state styling

### 11. Screen Transitions
- [ ] Add smooth transitions between screens
- [ ] Implement fade/slide animations
- [ ] Ensure consistent navigation animations

### 12. List Animations
- [x] Implement staggered entrance animations (HomeScreen category cards)
- [ ] Add subtle animations to other list items
- [ ] Add pull-to-refresh animations

## Form Improvements

### 13. Input Styling
- [ ] Improve input field design
- [ ] Add focus states
- [ ] Better error state styling
- [ ] Consistent input heights and padding

### 14. Error Handling
- [ ] Clear, helpful error messages
- [ ] Consistent error styling
- [ ] Inline field errors
- [ ] General error display

### 15. Success Feedback
- [ ] Success confirmations for actions
- [ ] Toast notifications for quick feedback
- [ ] Visual success indicators

## Screen-Specific Improvements

### 16. LoginScreen
- [ ] Improve layout and spacing
- [ ] Better visual hierarchy
- [ ] Add app branding/logo
- [ ] Improve form styling

### 17. HomeScreen
- [ ] Refine category card design
- [ ] Improve empty state
- [ ] Better button placement
- [ ] Enhanced gradient backgrounds

### 18. ProfileScreen
- [ ] Improve data presentation
- [ ] Better chart styling
- [ ] Enhanced section organization
- [ ] Improved form layouts

### 19. Session Screens
- [ ] Better session card design
- [ ] Improved session detail layout
- [ ] Enhanced data visualization
- [ ] Better empty states

### 20. Layout/Climb Screens
- [ ] Improve route/climb card design
- [ ] Better image handling
- [x] Enhanced interaction feedback (floating scroll-to-bottom button in list mode with scale animation and auto-hide)
- [ ] Improved modal designs

## Accessibility & Polish

### 21. Touch Targets
- [ ] Ensure all interactive elements are at least 44x44px
- [ ] Add proper spacing between touch targets
- [ ] Improve button sizes where needed

### 22. Visual Feedback
- [ ] Ensure all actions have clear feedback
- [ ] Add haptic feedback where appropriate
- [ ] Improve loading indicators

### 23. Consistency Check
- [ ] Audit all screens for design consistency
- [ ] Ensure similar components look the same
- [ ] Standardize modal designs
- [ ] Consistent header styling

## Priority Order

**Phase 1 (Foundation):**
1. Create design system file
2. Update shared styles
3. Spacing consistency
4. Typography hierarchy

**Phase 2 (Polish):**
5. Color consistency
6. Border radius & shadows
7. Empty states
8. Loading states

**Phase 3 (Interactions):**
9. Button interactions
10. Screen transitions
11. List animations
12. Form improvements

**Phase 4 (Refinement):**
13. Screen-specific improvements
14. Accessibility
15. Final consistency check
