'use client';

import { GithubOutlined, GoogleOutlined } from '@ant-design/icons';
import {
	Button,
	Form,
	Input,
	Modal,
	ModalBackdrop,
	ModalBody,
	ModalContainer,
	ModalDialog,
	ModalHeader,
	ModalTrigger,
} from '@heroui/react';
import { useEffect, useState } from 'react';

type LoginProps = {
	triggerClassName?: string;
	triggerLabel?: string;
};

const EMAIL_REGEXP = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_REGEXP = /^\d{4,6}$/;
const CODE_COOLDOWN_SECONDS = 80;

type AuthFields = {
	email: string;
	code: string;
};

export function Social() {
	return (
		<div className='flex w-full flex-col gap-3'>
			<Button
				className='w-full'
				variant='tertiary'
			>
				<GoogleOutlined className='text-base' />
				Sign in with Google
			</Button>
			<Button
				className='w-full'
				variant='tertiary'
			>
				<GithubOutlined className='text-base' />
				Sign in with GitHub
			</Button>
		</div>
	);
}

function AuthForm({
	onSubmit,
	onSendCode,
	sendingCode,
	cooldownSeconds,
	feedback,
	fields,
	onFieldChange,
}: {
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
	onSendCode: () => void;
	sendingCode: boolean;
	cooldownSeconds: number;
	feedback: string | null;
	fields: AuthFields;
	onFieldChange: (field: keyof AuthFields, value: string) => void;
}) {
	return (
		<Form
			className='flex w-full flex-col gap-3'
			onSubmit={onSubmit}
		>
			<label className='flex flex-col gap-1 text-sm text-[var(--app-text)]'>
				<span className='font-medium'>邮箱</span>
				<Input
					name='email'
					type='email'
					placeholder='you@example.com'
					value={fields.email}
					onChange={(event) =>
						onFieldChange('email', event.currentTarget.value)
					}
					required
					fullWidth
					variant='primary'
				/>
			</label>

			<div className='flex items-end gap-2'>
				<label className='flex min-w-0 flex-1 flex-col gap-1 text-sm text-[var(--app-text)]'>
					<span className='font-medium'>验证码</span>
					<Input
						name='code'
						type='text'
						placeholder='6 位数字'
						value={fields.code}
						onChange={(event) =>
							onFieldChange('code', event.currentTarget.value)
						}
						required
						pattern='\d{4,6}'
						fullWidth
						variant='primary'
					/>
				</label>
				<Button
					type='button'
					variant='tertiary'
					onPress={onSendCode}
					isDisabled={sendingCode || cooldownSeconds > 0}
					className='mb-[2px] whitespace-nowrap'
				>
					{sendingCode
						? '发送中...'
						: cooldownSeconds > 0
							? `${cooldownSeconds}s 后重试`
							: '发送验证码'}
				</Button>
			</div>

			{feedback ? (
				<p
					className='text-xs text-[var(--app-muted)]'
					role='status'
				>
					{feedback}
				</p>
			) : null}

			<Button
				type='submit'
				className='w-full mt-1 [background:var(--app-text)] [color:var(--app-bg)] hover:opacity-90 transition-opacity'
			>
				登录/注册
			</Button>
		</Form>
	);
}

export default function Login({
	triggerClassName,
	triggerLabel = '登录/注册',
}: LoginProps) {
	const [sendingCode, setSendingCode] = useState(false);
	const [cooldownSeconds, setCooldownSeconds] = useState(0);
	const [feedback, setFeedback] = useState<string | null>(null);
	const [formFields, setFormFields] = useState<AuthFields>({
		email: '',
		code: '',
	});

	useEffect(() => {
		if (cooldownSeconds <= 0) return;

		const timerId = window.setInterval(() => {
			setCooldownSeconds((prev) => {
				if (prev <= 1) {
					window.clearInterval(timerId);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => window.clearInterval(timerId);
	}, [cooldownSeconds]);

	const handleFieldChange = (field: keyof AuthFields, value: string) => {
		setFormFields((prev) => ({
			...prev,
			[field]: value,
		}));
	};

	const handleSendCode = () => {
		const email = formFields.email.trim();

		if (!email) {
			setFeedback('请先填写邮箱。');
			return;
		}

		if (!EMAIL_REGEXP.test(email)) {
			setFeedback('邮箱格式不正确，请检查后重试。');
			return;
		}

		if (cooldownSeconds > 0) {
			setFeedback(`请在 ${cooldownSeconds}s 后再发送验证码。`);
			return;
		}

		setSendingCode(true);
		window.setTimeout(() => {
			setSendingCode(false);
			setCooldownSeconds(CODE_COOLDOWN_SECONDS);
			setFeedback('验证码已发送，请查收邮箱。');
		}, 700);
	};

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const email = formFields.email.trim();
		const code = formFields.code.trim();

		if (!EMAIL_REGEXP.test(email)) {
			setFeedback('请输入正确的邮箱地址。');
			return;
		}

		if (!CODE_REGEXP.test(code)) {
			setFeedback('验证码必须是 4-6 位数字。');
			return;
		}

		setFeedback('登录成功。若邮箱未注册，将自动注册并完成登录。');
	};

	return (
		<Modal>
			<ModalTrigger>
				<button
					type='button'
					className={
						triggerClassName ??
						'cursor-pointer [background:var(--app-text)] [color:var(--app-bg)] rounded-full px-4 py-2 text-sm font-medium transition-colors opacity-95 hover:opacity-100'
					}
				>
					{triggerLabel}
				</button>
			</ModalTrigger>

			<ModalBackdrop>
				<ModalContainer
					placement='center'
					size='md'
				>
					<ModalDialog>
						<ModalHeader className='flex flex-col gap-1'>
							<h3 className='text-xl font-semibold text-[var(--app-text)]'>
								登录/注册
							</h3>
							<span className='text-xs text-[var(--app-muted)]'>
								未注册用户登陆后自动注册
							</span>
						</ModalHeader>

						<ModalBody className='pb-5 px-1'>
							<AuthForm
								onSubmit={handleSubmit}
								onSendCode={handleSendCode}
								sendingCode={sendingCode}
								cooldownSeconds={cooldownSeconds}
								feedback={feedback}
								fields={formFields}
								onFieldChange={handleFieldChange}
							/>

							<div className='relative my-4'>
								<div className='h-px w-full bg-[var(--app-border)]' />
								<span className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--app-panel)] px-2 text-xs text-[var(--app-muted)]'>
									或使用社交账号
								</span>
							</div>

							<Social />
						</ModalBody>
					</ModalDialog>
				</ModalContainer>
			</ModalBackdrop>
		</Modal>
	);
}
