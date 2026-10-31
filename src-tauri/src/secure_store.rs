// Keys are lowercase ASCII letters, digits, hyphens and underscores, 1–251
// bytes long. Windows device names are excluded. This preserves existing
// filenames for valid keys without case-folding or replacement collisions.
#[cfg(any(target_os = "windows", test))]
fn secret_filename(key: &str) -> Result<String, String> {
    let reserved = matches!(key, "con" | "prn" | "aux" | "nul")
        || (key.len() == 4
            && (key.starts_with("com") || key.starts_with("lpt"))
            && key.as_bytes()[3].is_ascii_digit());
    if key.is_empty()
        || key.len() > 251
        || reserved
        || !key.bytes().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-' || c == b'_')
    {
        return Err("invalid secure store key".into());
    }
    Ok(format!("{}.bin", key))
}

#[cfg(target_os = "windows")]
mod inner {
    use std::fs;
    use std::path::PathBuf;
    use tauri::AppHandle;
    use tauri::Manager;
    use winapi::um::dpapi::{CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN};
    use winapi::um::winbase::LocalFree;
    use winapi::um::wincrypt::CRYPT_INTEGER_BLOB;

    struct DpapiOutput(CRYPT_INTEGER_BLOB);

    impl DpapiOutput {
        fn bytes(&self) -> Result<&[u8], String> {
            if self.0.cbData == 0 {
                return Ok(&[]);
            }
            if self.0.pbData.is_null() {
                return Err("DPAPI returned an invalid buffer".into());
            }
            Ok(unsafe { std::slice::from_raw_parts(self.0.pbData, self.0.cbData as usize) })
        }
    }

    impl Drop for DpapiOutput {
        fn drop(&mut self) {
            if !self.0.pbData.is_null() {
                unsafe { LocalFree(self.0.pbData as _); }
            }
        }
    }

    fn secret_path(app: &AppHandle, key: &str) -> Result<PathBuf, String> {
        let filename = super::secret_filename(key)?;
        let mut p = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
        p.push("secure");
        fs::create_dir_all(&p).map_err(|e| e.to_string())?;
        p.push(filename);
        Ok(p)
    }

    fn to_hex(bytes: &[u8]) -> String {
        bytes.iter().map(|b| format!("{:02x}", b)).collect()
    }
    fn from_hex(s: &str) -> Result<Vec<u8>, String> {
        if s.len() % 2 != 0 { return Err("invalid hex".into()); }
        (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i+2], 16).map_err(|e| e.to_string())).collect()
    }

    pub fn secure_store_set(app: AppHandle, key: String, value: String) -> Result<(), String> {
        let input = value.as_bytes();
        let mut in_blob = CRYPT_INTEGER_BLOB { cbData: input.len() as u32, pbData: input.as_ptr() as *mut u8 };
        let mut out_blob = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
        let ok = unsafe {
            CryptProtectData(&mut in_blob, std::ptr::null(), std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut(), CRYPTPROTECT_UI_FORBIDDEN, &mut out_blob)
        };
        if ok == 0 { return Err("CryptProtectData failed".into()); }
        let output = DpapiOutput(out_blob);
        let encoded = to_hex(output.bytes()?);
        let p = secret_path(&app, &key)?;
        fs::write(p, encoded).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn secure_store_get(app: AppHandle, key: String) -> Result<Option<String>, String> {
        let p = secret_path(&app, &key)?;
        if !p.exists() { return Ok(None); }
        let encoded = fs::read_to_string(p).map_err(|e| e.to_string())?;
        let bytes = from_hex(encoded.trim())?;
        let mut in_blob = CRYPT_INTEGER_BLOB { cbData: bytes.len() as u32, pbData: bytes.as_ptr() as *mut u8 };
        let mut out_blob = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
        let ok = unsafe {
            CryptUnprotectData(&mut in_blob, std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut(), CRYPTPROTECT_UI_FORBIDDEN, &mut out_blob)
        };
        if ok == 0 { return Err("CryptUnprotectData failed".into()); }
        let output = DpapiOutput(out_blob);
        let text = String::from_utf8(output.bytes()?.to_vec()).map_err(|e| e.to_string())?;
        Ok(Some(text))
    }

    pub fn secure_store_delete(app: AppHandle, key: String) -> Result<(), String> {
        let p = secret_path(&app, &key)?;
        if p.exists() { fs::remove_file(p).map_err(|e| e.to_string())?; }
        Ok(())
    }
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn secure_store_set(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    inner::secure_store_set(app, key, value)
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn secure_store_get(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    inner::secure_store_get(app, key)
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn secure_store_delete(app: tauri::AppHandle, key: String) -> Result<(), String> {
    inner::secure_store_delete(app, key)
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn secure_store_set(_app: tauri::AppHandle, _key: String, _value: String) -> Result<(), String> {
    Err("unsupported".into())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn secure_store_get(_app: tauri::AppHandle, _key: String) -> Result<Option<String>, String> {
    Err("unsupported".into())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn secure_store_delete(_app: tauri::AppHandle, _key: String) -> Result<(), String> {
    Err("unsupported".into())
}

#[cfg(test)]
mod tests {
    use super::secret_filename;

    #[test]
    fn filenames_preserve_valid_keys_and_reject_ambiguous_or_unsafe_ones() {
        assert_eq!(secret_filename("desktop-session").unwrap(), "desktop-session.bin");
        assert_eq!(secret_filename("desktop-auth-pending").unwrap(), "desktop-auth-pending.bin");
        assert_ne!(secret_filename("a-b").unwrap(), secret_filename("a_b").unwrap());
        for key in ["", "A", "a/b", "a.b", "..", "é", "con", "lpt1", "com9"] {
            assert!(secret_filename(key).is_err(), "accepted {key:?}");
        }
        assert!(secret_filename(&"a".repeat(251)).is_ok());
        assert!(secret_filename(&"a".repeat(252)).is_err());
    }
}
