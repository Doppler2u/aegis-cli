module aegis::registry {
    use std::string::String;
    use aptos_framework::account;
    use aptos_std::simple_map::{Self, SimpleMap};
    use aptos_framework::timestamp;
    use std::signer;

    // Error codes
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_REPO_DOES_NOT_EXIST: u64 = 2;

    struct ImageMetadata has store, drop, copy {
        tag: String,
        blob_id: String,
        image_digest: String,
        size: u64,
        timestamp: u64,
        version: u64
    }

    struct Repository has key {
        owner: address,
        // Maps a Docker tag (e.g., "latest") to its metadata
        images: SimpleMap<String, ImageMetadata>,
        // Maps authorized user addresses to their encrypted AES key for this repo
        encrypted_keys: SimpleMap<address, vector<u8>>
    }

    /// Initialize a new repository
    public entry fun init_repository(account: &signer) {
        let addr = signer::address_of(account);
        
        let repo = Repository {
            owner: addr,
            images: simple_map::create(),
            encrypted_keys: simple_map::create()
        };
        
        move_to(account, repo);
    }

    /// Grant access to a user by storing their encrypted AES key
    public entry fun grant_access(
        account: &signer, 
        repo_owner: address, 
        grantee: address, 
        encrypted_key: vector<u8>
    ) acquires Repository {
        let caller = signer::address_of(account);
        assert!(caller == repo_owner, E_NOT_AUTHORIZED);
        
        let repo = borrow_global_mut<Repository>(repo_owner);
        if (simple_map::contains_key(&repo.encrypted_keys, &grantee)) {
            let key_ref = simple_map::borrow_mut(&mut repo.encrypted_keys, &grantee);
            *key_ref = encrypted_key;
        } else {
            simple_map::add(&mut repo.encrypted_keys, grantee, encrypted_key);
        };
    }

    /// Publish a new image tag and blob_id
    public entry fun publish_image(
        account: &signer,
        tag: String,
        blob_id: String,
        image_digest: String,
        size: u64
    ) acquires Repository {
        let addr = signer::address_of(account);
        assert!(exists<Repository>(addr), E_REPO_DOES_NOT_EXIST);

        let repo = borrow_global_mut<Repository>(addr);
        let now = timestamp::now_seconds();
        
        let version = 1;
        if (simple_map::contains_key(&repo.images, &tag)) {
            let old_meta = simple_map::borrow(&repo.images, &tag);
            version = old_meta.version + 1;
        };

        let new_metadata = ImageMetadata {
            tag,
            blob_id,
            image_digest,
            size,
            timestamp: now,
            version
        };

        if (simple_map::contains_key(&repo.images, &tag)) {
            let meta_ref = simple_map::borrow_mut(&mut repo.images, &tag);
            *meta_ref = new_metadata;
        } else {
            simple_map::add(&mut repo.images, tag, new_metadata);
        };
    }
}
