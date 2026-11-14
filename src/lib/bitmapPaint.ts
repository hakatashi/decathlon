// Drawing primitives on a square 1bpp bitmap (Uint8Array, 1 = black, 0 = white).

export type Bitmap = Uint8Array;

export interface Point {
	x: number,
	y: number,
}

export interface PaintTarget {
	bitmap: Bitmap,
	size: number,
}

export interface Segment {
	from: Point,
	to: Point,
}

export interface PaintStyle {
	brush: number,
	color: number,
	filled?: boolean,
}

const setPixel = ({bitmap, size}: PaintTarget, {x, y}: Point, color: number) => {
	if (x >= 0 && x < size && y >= 0 && y < size) {
		bitmap[y * size + x] = color;
	}
};

// Stamps a round brush of the given diameter centred at the point.
export const stamp = (target: PaintTarget, center: Point, {brush, color}: PaintStyle) => {
	const radius = brush / 2;
	const origin = Math.floor(brush / 2);
	for (let dy = 0; dy < brush; dy++) {
		for (let dx = 0; dx < brush; dx++) {
			const ox = dx + 0.5 - radius;
			const oy = dy + 0.5 - radius;
			if (ox * ox + oy * oy <= radius * radius + 0.25) {
				setPixel(target, {x: center.x - origin + dx, y: center.y - origin + dy}, color);
			}
		}
	}
};

export const drawLine = (target: PaintTarget, {from, to}: Segment, style: PaintStyle) => {
	let {x, y} = from;
	const dx = Math.abs(to.x - x);
	const dy = -Math.abs(to.y - y);
	const sx = x < to.x ? 1 : -1;
	const sy = y < to.y ? 1 : -1;
	let error = dx + dy;
	for (;;) {
		stamp(target, {x, y}, style);
		if (x === to.x && y === to.y) {
			break;
		}
		const e2 = 2 * error;
		if (e2 >= dy) {
			error += dy;
			x += sx;
		}
		if (e2 <= dx) {
			error += dx;
			y += sy;
		}
	}
};

const boundingBox = ({from, to}: Segment) => ({
	left: Math.min(from.x, to.x),
	right: Math.max(from.x, to.x),
	top: Math.min(from.y, to.y),
	bottom: Math.max(from.y, to.y),
});

export const drawRect = (target: PaintTarget, segment: Segment, style: PaintStyle) => {
	const {left, right, top, bottom} = boundingBox(segment);
	if (style.filled) {
		for (let y = top; y <= bottom; y++) {
			for (let x = left; x <= right; x++) {
				setPixel(target, {x, y}, style.color);
			}
		}
		return;
	}
	drawLine(target, {from: {x: left, y: top}, to: {x: right, y: top}}, style);
	drawLine(target, {from: {x: right, y: top}, to: {x: right, y: bottom}}, style);
	drawLine(target, {from: {x: right, y: bottom}, to: {x: left, y: bottom}}, style);
	drawLine(target, {from: {x: left, y: bottom}, to: {x: left, y: top}}, style);
};

export const drawEllipse = (target: PaintTarget, segment: Segment, style: PaintStyle) => {
	const {left, right, top, bottom} = boundingBox(segment);
	const cx = (left + right) / 2;
	const cy = (top + bottom) / 2;
	const rx = (right - left) / 2 + 0.5;
	const ry = (bottom - top) / 2 + 0.5;

	if (style.filled) {
		for (let y = top; y <= bottom; y++) {
			for (let x = left; x <= right; x++) {
				const nx = (x - cx) / rx;
				const ny = (y - cy) / ry;
				if (nx * nx + ny * ny <= 1) {
					setPixel(target, {x, y}, style.color);
				}
			}
		}
		return;
	}

	const steps = Math.max(16, Math.ceil(2 * Math.PI * Math.max(rx, ry)));
	let previous: Point | null = null;
	for (let i = 0; i <= steps; i++) {
		const theta = (2 * Math.PI * i) / steps;
		const point = {
			x: Math.round(cx + (rx - 0.5) * Math.cos(theta)),
			y: Math.round(cy + (ry - 0.5) * Math.sin(theta)),
		};
		if (previous === null) {
			stamp(target, point, style);
		} else {
			drawLine(target, {from: previous, to: point}, style);
		}
		previous = point;
	}
};

// 4-connected flood fill
export const floodFill = ({bitmap, size}: PaintTarget, start: Point, color: number) => {
	if (start.x < 0 || start.x >= size || start.y < 0 || start.y >= size) {
		return;
	}
	const targetColor = bitmap[start.y * size + start.x];
	if (targetColor === color) {
		return;
	}
	const stack = [start.y * size + start.x];
	for (let index = stack.pop(); index !== undefined; index = stack.pop()) {
		if (bitmap[index] !== targetColor) {
			continue;
		}
		bitmap[index] = color;
		const x = index % size;
		if (x > 0) {
			stack.push(index - 1);
		}
		if (x < size - 1) {
			stack.push(index + 1);
		}
		if (index >= size) {
			stack.push(index - size);
		}
		if (index < size * (size - 1)) {
			stack.push(index + size);
		}
	}
};

export const renderBitmap = (canvas: HTMLCanvasElement, {bitmap, size}: PaintTarget) => {
	const context = canvas.getContext('2d');
	if (!context) {
		return;
	}
	const imageData = context.createImageData(size, size);
	for (let i = 0; i < bitmap.length; i++) {
		const value = bitmap[i] ? 0 : 255;
		imageData.data[i * 4] = value;
		imageData.data[i * 4 + 1] = value;
		imageData.data[i * 4 + 2] = value;
		imageData.data[i * 4 + 3] = 255;
	}
	context.putImageData(imageData, 0, 0);
};
