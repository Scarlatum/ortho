import { vec3 } from "gl-matrix";
import { SceneInterface } from "../../interfaces/scene.interface";

const enum PointLayout {
	visible = 0,
	color 	= 4,
	pos 		= 8,
	range 	= 11,
	spread 	= range + 1,
}

class PointController {

	static capacity = 10;
	static quantity = 0;
	static currentIndex = -1;

	private static readonly layout = {
		visible : PointLayout.visible,
		color		: PointLayout.color,
		pos			: PointLayout.pos,
		range		: PointLayout.range,
	};

	static readonly spread 	= PointLayout.spread;
	static readonly buffer 	= new ArrayBuffer(
		Float32Array.BYTES_PER_ELEMENT * PointController.capacity * PointController.spread
	);

	static set(index: number, key: keyof typeof PointController['layout'], value: ArrayLike<number>) {
		new Float32Array(PointController.buffer).set(
			value, 
			PointController.spread
			* index
			+ PointController.layout[key]
		);
	}

	static get(index: number, key: keyof typeof PointController['layout']) {

		const begin = PointController.spread * index + PointController.layout[key];
		const end 	= begin + PointController.layout[key];

		return new Float32Array(PointController.buffer).subarray(begin, end);

	}

	static inc() {

		PointController.currentIndex++;

		return PointController.currentIndex;

	}

}

export class PointLight {

	public index = PointController.inc();

	set position(pos: vec3) {
		PointController.set(this.index, "pos", pos);
	}

	set visible(x: boolean) {
		PointController.set(this.index, "visible", [ Number(x) ])
	}

	set color(color: vec3) {
		PointController.set(this.index, "color", color);
	}

	set range(x: number) {
		PointController.set(this.index, "range", [ x ]);
	}

	// Getters

	get position() {
		return PointController.get(this.index, "pos");
	}

	get visible() {
		return !!PointController.get(this.index, "visible")[0];
	}

	get color() {
		return PointController.get(this.index, "color");
	}

	get range() {
		return PointController.get(this.index, "range")[0];
	}

}

export class PointLightRepository {


	public lights = new Set<PointLight>();
	public buffer = device.createBuffer({
		size: Float32Array.BYTES_PER_ELEMENT * PointController.capacity * PointController.spread,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
	});

	public bindgroup: GPUBindGroup;

	constructor(scene: SceneInterface) {
		this.bindgroup = device.createBindGroup({
			layout: scene.pipeline.getBindGroupLayout(3),
			entries: [
				{ binding: 0, resource: { buffer: this.buffer } }
			]
		});
	}

	public add(x: PointLight) {

		this.lights.add(x);

	}

	public update() {
		device.queue.writeBuffer(this.buffer, 0, PointController.buffer);
	}

}