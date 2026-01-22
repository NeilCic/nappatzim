# Roles & Permissions - TODO

## Overview
Implement role-based access control (RBAC) with four roles: Admin, Gym Manager, Setter, and User.

## Current Status
⚠️ **PARTIALLY IMPLEMENTED**: The `role` field exists in the User schema (`role String @default("user")`), but:
- ❌ No authorization middleware exists
- ❌ No role-based checks in controllers/services
- ❌ No frontend role handling
- ❌ No layout ownership model implemented

**The role field is in the database but not functionally used anywhere.**

## Roles

### 1. **Admin**
- **Can do**: Everything (full system access)
- **Use case**: System administrators, developers

### 2. **Gym Manager**
- **Can do**:
  - Upload/create layouts
  - Delete layouts **they own** (future: multiple layouts per paid tier)
  - Create/delete/reset spots within layouts they own
  - Create/delete climbs within spots they own
  - Upload/delete videos for climbs on layouts they own
  - Moderate comments on their layouts: **delete** comments but **not edit** comment text
  - **Future**: Manage a "news section" for their gym(s)
- **Use case**: Gym owners, head setters who manage entire gyms

### 3. **Setter**
- **Can do**:
  - Register new climbs into **existing spots** (cannot create spots)
  - Edit climbs they created (or all climbs in their assigned spots? TBD)
  - Upload videos for climbs
  - Add comments
- **Cannot do**:
  - Create/delete spots
  - Create/delete layouts
- **Use case**: Route setters who add climbs to existing spots

> **Important:** Setters are meaningful only **within a gym**. A setter must belong to (be associated with) a specific gym/layout owner. In \"community mode\" (layouts with `ownerId = null`), we do **not** plan to assign any users the `SETTER` role; they behave effectively as normal users there.

### 4. **User** (existing)
- **Can do**: Everything a regular user can do now (view, vote, comment, create sessions, etc.)
- **Cannot do**: Create/modify layouts, spots, or climbs

---

## Implementation Plan

### Phase 1: Database & Backend Foundation

#### 1.1 Database Schema Changes
- [x] Add `role` field to `User` model in `schema.prisma` ✅ (Field exists: `role String @default("user")`)
  - ⚠️ **Note**: Currently uses `String` type, not an Enum. Values are stored as strings.
  - ⚠️ **Note**: Default is `"user"` (lowercase), not `"USER"` (uppercase)
  - ❌ Migration to set existing users to `USER` role: NOT DONE
  - ⚠️ **TODO**: Consider converting to Enum type for type safety
- [ ] Implement layout ownership model
  - **Decision**: Use explicit ownership (`layout.ownerId` pointing to `User.id`)
  - Default: layouts created via script / legacy data have `ownerId = null` (\"community\" layouts)
  - Future: a gym manager can own **one layout by default**; multiple layouts become a **paid** feature (or via extra manager users)
- [ ] Setter assignment model
  - **Decision**: Setters can add climbs to **any spot** (role-based, no assignment) for now
  - Future: optional many-to-many assignment between setters and layouts/spots if needed

#### 1.2 Backend Authorization Middleware
- [ ] Create `authorize.js` middleware (similar to `auth.js`)
  - Functions: `requireRole(roles)`, `requireAdmin()`, `requireGymManager()`, `requireSetter()`
  - Check `req.user.role` against required role(s)
- [ ] Update existing `auth.js` middleware to include `role` in `req.user` object

#### 1.3 Backend Service/Controller Updates
- [ ] **Layout operations**:
  - `createLayout`: Require `GYM_MANAGER` or `ADMIN`
  - `updateLayout`: Require layout owner or `ADMIN`
  - `deleteLayout`: Require layout owner or `ADMIN`
  - **Community behavior**: If `ownerId` is `null` (legacy/community layouts), keep current behavior (anyone can interact as today) until a paying gym manager claims the layout.
- [ ] **Spot operations**:
  - `createSpot`: Require `GYM_MANAGER` or `ADMIN` **for owned layouts**; for community layouts (no owner) keep current behavior
  - `updateSpot`: Require layout owner or `ADMIN` for owned layouts; community layouts behave as today
  - `deleteSpot`: Require layout owner or `ADMIN` for owned layouts; community layouts behave as today
- [ ] **Climb operations**:
  - `createClimb`: Require `SETTER`, `GYM_MANAGER`, or `ADMIN` (anywhere)
  - `updateClimb`: Allow setter (via `setterId`), layout owner, or `ADMIN`
  - `deleteClimb`: Require layout owner or `ADMIN` for owned layouts; community layouts behave as today
- [ ] **Video operations**:
  - `createVideo`: Already user-specific (one per user per climb), but consider allowing `GYM_MANAGER`/`ADMIN` to delete any video
  - `deleteVideo`: Keep current (owner only) + allow `GYM_MANAGER`/`ADMIN` to delete any video on their layouts
- [ ] **Comment operations**:
  - `createComment`: Keep current (any authenticated user)
  - `deleteComment`: Keep current (owner) + allow `GYM_MANAGER`/`ADMIN` to delete comments on their layouts
- [ ] **Vote operations**: Keep current (any authenticated user)

#### 1.4 Admin Endpoints (Optional)
- [ ] Create admin-only endpoints for role management:
  - `PATCH /admin/users/:userId/role` - Change user role (admin only)
  - `GET /admin/users` - List all users with roles (admin only)

### Phase 2: Frontend Updates

#### 2.1 User Context Enhancement
- [ ] Update `UserProvider` to include `role` field
- [ ] Create `useRole()` hook or extend `useUser()` to check roles:
  - `isAdmin()`, `isGymManager()`, `isSetter()`, `isUser()`

#### 2.2 UI Conditional Rendering
- [ ] **HomeScreen**: Show "Create Layout" button only for `GYM_MANAGER`/`ADMIN`
- [ ] **LayoutDetailScreen**: 
  - Show "Create Spot" button only for `GYM_MANAGER`/`ADMIN`
  - Show "Add Climb" button for `SETTER`/`GYM_MANAGER`/`ADMIN` (when spot selected)
- [ ] **ClimbDetailScreen**: 
  - Show delete/edit buttons based on role and ownership
- [ ] **ProfileScreen**: 
  - Show role badge/indicator (optional, for admins/managers)
  - **Future**: Role management UI for admins

### Phase 3: Future Enhancements

#### 3.1 Layout Ownership & Assignment
- [ ] Implement layout ownership model (if Option C chosen)
- [ ] Add UI for gym managers to "claim" or assign layouts
- [ ] Add UI for assigning setters to specific layouts/spots

#### 3.2 News Section (Gym Manager Feature)
- [ ] Create `GymNews` model (title, content, layoutId, authorId, createdAt, etc.)
- [ ] Backend: CRUD endpoints for news (gym manager only)
- [ ] Frontend: News section in LayoutDetailScreen or separate screen
- [ ] Display news on layout/home screens

#### 3.3 Advanced Permissions
- [ ] Setter-specific permissions (e.g., can only edit climbs they created)
- [ ] Multi-gym support (gym managers can manage multiple layouts)
- [ ] Permission inheritance (e.g., gym managers inherit setter permissions)

---

## Questions & Decisions Needed

1. **Layout ownership**: (DECIDED) Explicit ownership (`layout.ownerId`); gym managers control only the layouts they own.

2. **Setter assignment**: (DECIDED for now) Role-based: setters can add climbs to any spot; explicit assignments deferred.

3. **Role assignment**: How do users get assigned roles initially?
   - **Recommendation**: Admin-only endpoint for now, later add invitation system

4. **Existing data**: What role should existing users get?
   - **Recommendation**: All existing users → `USER` role

5. **Climb ownership**: Should climbs track a `setterId` (already exists) or rely on role checks?
   - **Current**: `Climb` has optional `setterId` field
   - **Recommendation**: Use `setterId` for ownership, but allow `GYM_MANAGER`/`ADMIN` to edit any climb

6. **Video permissions**: Should gym managers be able to delete any video on their layouts?
   - **Recommendation**: Yes, for moderation purposes

7. **Comment moderation**: Should gym managers be able to delete any comment on their layouts?
   - **Recommendation**: Yes, for moderation purposes

---

## Migration Strategy

1. **Database migration**: Add `role` enum and field, default existing users to `USER`
2. **Backend**: Add authorization middleware, update controllers/services incrementally
3. **Frontend**: Add role checks to UI conditionally (graceful degradation if role missing)
4. **Testing**: Test each role's permissions thoroughly before production

---

## Notes

- Keep backward compatibility: If `role` is missing/null, treat as `USER`
- Consider adding role to JWT payload for faster checks (optional optimization)
- Future: Consider more granular permissions (e.g., "can delete comments" as separate permission vs role)
