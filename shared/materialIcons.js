const styles = {
  fungsi: 'blue',
  geometri: 'teal',
  statistik: 'orange',
  peluang: 'purple',
  aljabar: 'pink',
  transformasi: 'lime',
};
export function chooseMaterialIcon(title, topicId) {
  const text = title.toLowerCase();
  const rules = [
    ['fungsi', /fungsi|komposisi|invers fungsi|domain/],
    ['geometri', /lingkaran|sudut|busur|juring|singgung/],
    ['statistik', /statistik|data|median|rata-rata|varians/],
    ['peluang', /peluang|probabilitas|permutasi|kombinasi/],
    ['aljabar', /matriks|determinan|aljabar/],
    ['transformasi', /transformasi|rotasi|refleksi|translasi|dilatasi/],
  ];
  const icon =
    rules.find(([, pattern]) => pattern.test(text))?.[0] ||
    (Object.hasOwn(styles, topicId)
      ? topicId
      : Object.keys(styles)[[...text].reduce((sum, c) => sum + c.codePointAt(0), 0) % 6]);
  return { icon, color: styles[icon] };
}
