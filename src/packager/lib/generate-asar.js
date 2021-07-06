import pickle from 'chromium-pickle-js';

const generateAsar = (files) => {
  // https://github.com/electron/asar#format

  const header = {
    files: {}
  };
  let offset = 0;
  for (const {path, data} of files) {
    header.files[path] = {
      offset: offset.toString(),
      size: data.length
    };
    offset += data.length;
  }

  const headerPickle = pickle.createEmpty();
  headerPickle.writeString(JSON.stringify(header));
  const headerBuffer = headerPickle.toBuffer();
  const sizePickle = pickle.createEmpty();
  sizePickle.writeUInt32(headerBuffer.length);
  const sizeBuffer = sizePickle.toBuffer();

  const totalSize = headerBuffer.length + sizeBuffer.length + offset;
  const result = new Uint8Array(totalSize);
  let i = 0;
  result.set(sizeBuffer, i);
  i += sizeBuffer.length;
  result.set(headerBuffer, i);
  i += headerBuffer.length;
  for (const {data} of files) {
    result.set(data, i);
    i += data.length;
  }
  return result;
};

export default generateAsar;
