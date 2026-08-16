# Expansion-ready content contract

## Principle

The base game owns simulation, saving, navigation, accessibility, content loading, compatibility, and safe fallbacks. Expansion packs supply declarative content and approved runtime assets. A pack must not fork or replace the core care engine.

## Minimum pack manifest

Each future pack uses stable, namespaced IDs and declares:

- pack ID, schema version, content version, and minimum compatible game version;
- display metadata and localizable text keys;
- included room, skin, trick, animation, audio, and thumbnail IDs;
- asset paths, integrity/version metadata, and platform/runtime constraints;
- dependencies and conflicts;
- fallback room, skin, and animation behavior when content is unavailable;
- an optional entitlement key that remains inert until commerce is approved.

## Content categories

- **Rooms:** presentation, object layout, lighting, audio palette, and interaction slots; they cannot change care math silently.
- **Skins:** presentation mapped to a validated pet rig/species/growth-stage contract; missing compatibility falls back to an approved base skin.
- **Tricks:** declarative command, state-machine events, animation IDs, rewards, accessibility copy, and replay rules; they cannot bypass training or persistence guards.

## Save and entitlement rules

- Saves store stable IDs, never file paths or store-product labels.
- Unknown, removed, incompatible, or unowned IDs load safely through base-game fallbacks without corrupting the save.
- Content ownership is queried through an entitlement adapter. The first implementation may use a local all-base-content provider; storefront SDKs and network services remain outside the base simulation.
- Removing access never deletes earned core progress. No paid content may be required to recover a pet, avoid punishment, or complete the advertised base care loop.

## Build order

1. Stabilize the base-game state and save contracts.
2. Add a local content registry and one built-in pack through the same interface.
3. Validate missing/incompatible pack fallbacks and save migration.
4. Prove one room, one skin, and one trick as independent content additions.
5. Only then design catalog, download, entitlement, pricing, parental, refund, and platform-store behavior through separate human gates.

## Acceptance boundary

“Expansion-ready” means the base game loads built-in declarative packs and survives missing content. It does not mean purchases, remote downloads, accounts, analytics, or a storefront have been implemented.
