declare module '*.png' {
	const src: import('next/image').StaticImageData;
	export default src;
}

declare module '*.jpg' {
	const src: import('next/image').StaticImageData;
	export default src;
}

declare module '*.ico' {
	const src: import('next/image').StaticImageData;
	export default src;
}
