/**
 * zip / AI Studio 有机模糊渐变球背景层。
 * 放在页面根容器内（父容器需 `relative`），绝对定位、不拦截指针事件。
 */
export default function BackgroundBlobs() {
	return (
		<div
			aria-hidden
			className='pointer-events-none absolute inset-0 z-0 overflow-hidden'
		>
			<div className='absolute left-[-5%] top-[-10%] h-[60vw] w-[60vw] rounded-full bg-orange-50/60 blur-[100px] mix-blend-multiply dark:bg-orange-950/10' />
			<div className='absolute bottom-[-10%] right-[-10%] h-[60vw] w-[60vw] rounded-full bg-blue-50/60 blur-[100px] mix-blend-multiply dark:bg-blue-950/10' />
		</div>
	);
}
