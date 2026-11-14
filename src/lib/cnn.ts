// Minimal CNN inference engine for the "CNN Reversing" game.
// The model binary format is produced by decathlon-infra/assets/system-test-2/cnn-reversing/training/export.py.

export const CNN_IMAGE_SIZE = 128;

interface ConvLayer {
	type: 'conv',
	inChannels: number,
	outChannels: number,
	stride: number,
	kernel: number,
	padding: number,
	weightOffset: number,
	biasOffset: number,
	relu: boolean,
}

interface GapLayer {
	type: 'gap',
}

interface DenseLayer {
	type: 'dense',
	inFeatures: number,
	outFeatures: number,
	weightOffset: number,
	biasOffset: number,
}

type Layer = ConvLayer | GapLayer | DenseLayer;

export interface CnnModel {
	inputSize: number,
	layers: Layer[],
	params: Float32Array,
}

export const parseCnnModel = (buffer: ArrayBuffer): CnnModel => {
	const view = new DataView(buffer);
	const headerLength = view.getUint32(0, true);
	const headerText = new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength));
	const header = JSON.parse(headerText) as {version: number, inputSize: number, layers: Layer[]};
	if (header.version !== 1) {
		throw new Error(`Unsupported model version: ${header.version}`);
	}
	const dataOffset = 4 + headerLength;
	const params = new Float32Array(buffer.slice(dataOffset));
	return {inputSize: header.inputSize, layers: header.layers, params};
};

interface FeatureMap {
	data: Float32Array,
	height: number,
	width: number,
}

const conv2d = ({data: input, height, width}: FeatureMap, layer: ConvLayer, params: Float32Array): FeatureMap => {
	const {inChannels, outChannels, stride, kernel, padding, weightOffset, biasOffset} = layer;
	const outHeight = Math.floor((height + 2 * padding - kernel) / stride) + 1;
	const outWidth = Math.floor((width + 2 * padding - kernel) / stride) + 1;
	const outPlane = outHeight * outWidth;
	const inPlane = height * width;
	const output = new Float32Array(outChannels * outPlane);

	for (let co = 0; co < outChannels; co++) {
		const outBase = co * outPlane;
		output.fill(params[biasOffset + co], outBase, outBase + outPlane);

		for (let ci = 0; ci < inChannels; ci++) {
			const inBase = ci * inPlane;
			const weightBase = weightOffset + (co * inChannels + ci) * kernel * kernel;

			for (let ky = 0; ky < kernel; ky++) {
				for (let kx = 0; kx < kernel; kx++) {
					const weight = params[weightBase + ky * kernel + kx];
					if (weight === 0) {
						continue;
					}
					const dx = kx - padding;
					// output x range where 0 <= ox * stride + dx < width
					const oxStart = Math.max(0, Math.ceil(-dx / stride));
					const oxEnd = Math.min(outWidth, Math.floor((width - 1 - dx) / stride) + 1);

					for (let oy = 0; oy < outHeight; oy++) {
						const iy = oy * stride + ky - padding;
						if (iy < 0 || iy >= height) {
							continue;
						}
						const inRow = inBase + iy * width + dx;
						const outRow = outBase + oy * outWidth;
						for (let ox = oxStart; ox < oxEnd; ox++) {
							output[outRow + ox] += weight * input[inRow + ox * stride];
						}
					}
				}
			}
		}

		if (layer.relu) {
			for (let i = outBase; i < outBase + outPlane; i++) {
				if (output[i] < 0) {
					output[i] = 0;
				}
			}
		}
	}

	return {data: output, height: outHeight, width: outWidth};
};

// image: row-major 128x128, 1 = ink (black), 0 = background (white)
export const runCnn = (model: CnnModel, image: Uint8Array): number => {
	let data: Float32Array = Float32Array.from(image);
	let height = model.inputSize;
	let width = model.inputSize;
	let channels = 1;

	for (const layer of model.layers) {
		if (layer.type === 'conv') {
			const result = conv2d({data, height, width}, layer, model.params);
			data = result.data;
			height = result.height;
			width = result.width;
			channels = layer.outChannels;
		} else if (layer.type === 'gap') {
			const pooled = new Float32Array(channels);
			const plane = height * width;
			for (let c = 0; c < channels; c++) {
				let sum = 0;
				for (let i = c * plane; i < (c + 1) * plane; i++) {
					sum += data[i];
				}
				pooled[c] = sum / plane;
			}
			data = pooled;
			height = 1;
			width = 1;
		} else {
			const out = new Float32Array(layer.outFeatures);
			for (let o = 0; o < layer.outFeatures; o++) {
				let sum = model.params[layer.biasOffset + o];
				for (let i = 0; i < layer.inFeatures; i++) {
					sum += model.params[layer.weightOffset + o * layer.inFeatures + i] * data[i];
				}
				out[o] = sum;
			}
			data = out;
		}
	}

	return data[0];
};

// Packs a 128x128 binary image into 2048 bytes (MSB first) and encodes it in base64.
export const encodeCnnImage = (image: Uint8Array): string => {
	const packed = new Uint8Array(image.length / 8);
	for (let i = 0; i < image.length; i++) {
		if (image[i]) {
			packed[i >> 3] |= 0x80 >> (i & 7);
		}
	}
	let binary = '';
	for (const byte of packed) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
};

export const decodeCnnImage = (encoded: string): Uint8Array => {
	const binary = atob(encoded);
	const image = new Uint8Array(binary.length * 8);
	for (let i = 0; i < image.length; i++) {
		image[i] = (binary.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
	}
	return image;
};
