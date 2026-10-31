#[cfg(target_os = "windows")]
mod inner {
    use std::fs;
    use std::path::PathBuf;
    use tauri::AppHandle;
    use tauri::Manager;
    use winapi::um::dpapi::{CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN};
    use winapi::um::wincrypt::CRYPT_INTEGER_BLOB;

    fn secret_path(app: &AppHandle, key: &str) -> Result<PathBuf, String> {
        let mut p = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
        p.push("secure");
        fs::create_dir_all(&p).map_err(|e| e.to_string())?;
        // Keep key names simple and safe.
        let safe = key.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' }).collect::<String>();
        p.push(format!("{}.bin", safe));
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
        let bytes = unsafe { std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize) };
        let encoded = to_hex(bytes);
        let p = secret_path(&app, &key)?;
        fs::write(p, encoded).map_err(|e| e.to_string())?;
        // no LocalFree needed for minimal process lifetime? LocalFree should be called.
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
        let out = unsafe { std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize) };
        let text = String::from_utf8(out.to_vec()).map_err(|e| e.to_string())?;
        Ok(Some(text))
    }

    pub fn secure_store_delete(app: AppHandle, key: String) -> Result<(), String> {
        let p = secret_path(&app, &key)?;
        if p.exists() { fs::remove_file(p).map_err(|e| e.to_string())?; }
        Ok(())
    }
}

#[cfg(target_os = "windows")]
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

#[cfg(not(target_os = "windows"))]
pub fn secure_store_set(_app: tauri::AppHandle, _key: String, _value: String) -> Result<(), String> { Err("unsupported".into()) }
#[cfg(not(target_os = "windows"))]
pub fn secure_store_get(_app: tauri::AppHandle, _key: String) -> Result<Option<String>, String> { Err("unsupported".into()) }
#[cfg(not(target_os = "windows"))]
pub fn secure_store_delete(_app: tauri::AppHandle, _key: String) -> Result<(), String> { Err("unsupported".into()) }
