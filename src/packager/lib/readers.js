export const readAsArrayBuffer = (o) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve(fr.result);
  fr.onerror = () => reject(new Error('Can not read as array buffer'));
  fr.readAsArrayBuffer(o);
});

export const readAsURL = (o) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve(fr.result);
  fr.onerror = () => reject(new Error('Can not read as URL'));
  fr.readAsDataURL(o);
});
