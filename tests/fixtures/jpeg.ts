/** Test photos: a 64 × 48 px JPEG and a builder for an EXIF block with capture time and GPS position. */

export const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAwAEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDpKKKK8c7woqjqepiwVVVQ8jg4BPA9z/n1rnZ7u4uT++mZxnOCePy6U0i4wbOworjYbia3bdDKyHIJweDj19a3tL1Y3bCCZQJQuQ2eH/D1/wDr0NDlBo1KKKKRmFFFFAHH3c5ubuWbnDtxkc47fpUNSXEJt7iSFs5RiMkYz71HWh1IKVHaORZEOGUgg+hpKFUswVQSScADqaAOzikE0KSqCA6hhnrzT6ZBH5MEcWd2xQucdcCn1mcoUUUUAZeraWbsiaAKJQPmB43+n4/57Vzzo8blJEZGHUMMEV2tMkijmXbLGrgHOGGRTTNIztocYqlmCqCSTgAdTW7pOkvFItzcqucZRD1B9T/nv7VrRwQw58qJI89dqgZp9NsJTvsFFFFSZn//2Q==',
  'base64',
);

/** EXIF (big endian) with DateTimeOriginal and a GPS latitude, inserted right after the start-of-image marker. */
export function withExif(jpeg: Buffer, dateTimeOriginal = '2026:10:13 09:15:02'): Buffer {
  const tiff = Buffer.alloc(130);
  tiff.write('MM', 0, 'latin1');
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  const entry = (at: number, tag: number, type: number, count: number, value: number) => {
    tiff.writeUInt16BE(tag, at);
    tiff.writeUInt16BE(type, at + 2);
    tiff.writeUInt32BE(count, at + 4);
    tiff.writeUInt32BE(value, at + 8);
  };
  // IFD0: pointers to the EXIF and GPS IFDs
  tiff.writeUInt16BE(2, 8);
  entry(10, 0x8769, 4, 1, 38);
  entry(22, 0x8825, 4, 1, 56);
  // EXIF IFD: DateTimeOriginal
  tiff.writeUInt16BE(1, 38);
  entry(40, 0x9003, 2, 20, 86);
  // GPS IFD: latitude reference "N" and latitude 46° 46' 0"
  tiff.writeUInt16BE(2, 56);
  entry(58, 0x0001, 2, 2, 0);
  tiff.write('N', 66, 'latin1');
  entry(70, 0x0002, 5, 3, 106);
  tiff.write(`${dateTimeOriginal}\0`, 86, 'latin1');
  [46, 1, 46, 1, 0, 1].forEach((v, i) => tiff.writeUInt32BE(v, 106 + i * 4));
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const head = Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 0xff]);
  return Buffer.concat([jpeg.subarray(0, 2), head, body, jpeg.subarray(2)]);
}
