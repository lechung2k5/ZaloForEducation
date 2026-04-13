import { BadRequestException } from '@nestjs/common';

/**
 * Regex chuẩn: dd-mm-yyyy (Ngày 01-31, Tháng 01-12, Năm 19xx hoặc 20xx)
 */
export const DOB_REGEX = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[012])-(19|20)\d\d$/;

/**
 * Kiểm tra xem chuỗi có đúng định dạng dd-mm-yyyy không.
 */
export function isValidDobFormat(str: string): boolean {
  return DOB_REGEX.test(str);
}

/**
 * Normalize bất kỳ chuỗi ngày nào (dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd) 
 * về định dạng chuẩn dd-mm-yyyy.
 * Trả về null nếu không thể parse được.
 */
export function toStorageDate(raw: string | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;

  // Split by any common separator: - / . or space
  const parts = s.split(/[-/. ]/);
  if (parts.length !== 3) return null;

  let day = '';
  let month = '';
  let year = '';

  // Detect YYYY-MM-DD
  if (parts[0].length === 4) {
    [year, month, day] = parts;
  } else {
    // Assume DD-MM-YYYY
    [day, month, year] = parts;
  }

  const d = day.padStart(2, '0');
  const m = month.padStart(2, '0');
  const y = year;

  // Kiểm tra độ dài
  if (d.length !== 2 || m.length !== 2 || y.length !== 4) return null;
  
  // Kiểm tra tính hợp lệ về số
  if (isNaN(Number(d)) || isNaN(Number(m)) || isNaN(Number(y))) return null;

  const result = `${d}-${m}-${y}`;
  
  // Kiểm tra lần cuối bằng Regex chuẩn
  if (!DOB_REGEX.test(result)) return null;

  return result;
}

/**
 * Hàm validate nghiêm ngặt cho sếp yêu cầu: 
 * Nếu không đúng định dạng dd-mm-yyyy thì quăng lỗi 400.
 */
export function validateDobStrict(dob: string | undefined): string {
  if (!dob) return '';
  
  // Đầu tiên cố gắng normalize
  const normalized = toStorageDate(dob);
  
  // Nếu không thể normalize hoặc không khớp Regex sau khi normalize
  if (!normalized) {
    throw new BadRequestException('Ngày sinh không hợp lệ hoặc sai định dạng. Vui lòng dùng dd-mm-yyyy.');
  }
  
  return normalized;
}
